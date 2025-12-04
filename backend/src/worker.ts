import { randomUUID } from "crypto";
import { Payment, paymentStore } from "./models/payment";
import { verifyDepositTx } from "./lib/eth";
import { createNearIntent } from "./lib/nearClient";
import { ethers, parseUnits } from "ethers";
import { verifySolDepositTx } from "./lib/solana";

/**
 * Process a single payment through the full lifecycle:
 * 1. Verify ETH deposit
 * 2. Burn ZEC (privacy layer)
 * 3. Post NEAR intent
 * 4. Hand off to solver via NEAR intent (solver spends shielded ZEC balance)
 */
export async function processPayment(payment: Payment): Promise<void> {
  try {
    console.log(`Processing payment ${payment.id}, status: ${payment.status}`);
    console.log(`Funding tx hash present: ${Boolean(payment.fundingTxHash)} value: ${payment.fundingTxHash ?? "none"}`);

    // Step 1: Verify funding transaction
    if (payment.status === "WAITING_FOR_FUNDING") {
      if (!payment.fundingTxHash) {
        console.log(`Payment ${payment.id} has no funding tx yet`);
        return;
      }

      const payAsset = (payment.payAsset || "").toUpperCase();
      const isSolPay = payAsset.startsWith("SOL") || payAsset.includes("USDC_SOL");

      let confirmed = true;
      if (!isSolPay) {
        const expectedAmount = (
          parseFloat(payment.amountEth) * 1.001
        ).toFixed(6);

        confirmed = await verifyDepositTx(
          payment.fundingTxHash,
          expectedAmount
        );
      } else {
        const expectedSol = payment.payAmountFunding || payment.amountEth;
        console.log(
          `[SOL] Verifying SOL funding for payment ${payment.id} tx=${payment.fundingTxHash} expected=${expectedSol} payAsset=${payAsset} rpc=${process.env.SOL_RPC_URL}`
        );
        confirmed = await verifySolDepositTx(
          payment.fundingTxHash,
          expectedSol,
          process.env.SOL_COLLECTOR_ADDRESS
        );
      }

      if (!confirmed) {
        console.log(`Payment ${payment.id} funding not confirmed yet`);
        return;
      }

      console.log(`✓ Payment ${payment.id} funding confirmed`);
      paymentStore.update(payment.id, { status: "FUNDED" });
      payment = paymentStore.get(payment.id)!;
    }

    // Step 2: Post NEAR intent for solvers (solver funds the payout)
    if (payment.status === "FUNDED") {
      const intentId = randomUUID();

      console.log(`Posting NEAR intent for payment ${payment.id}`);

      const destAssetRaw = (payment.destAsset || "ETH").toUpperCase();
      const isUsdcSol = destAssetRaw === "USDC_SOL" || destAssetRaw === "USDC-SOL";
      const destAsset = isUsdcSol ? "USDC" : destAssetRaw;
      const destAmount = payment.destAmount || payment.amountEth;
      const destDecimals =
        payment.destDecimals ?? (destAsset === "USDC" ? 6 : destAsset === "SOL" ? 9 : 18);

      const amountAtomic = parseUnits(destAmount, destDecimals).toString();
      const destChain =
        payment.destChain ||
        (destAsset === "SOL" || isUsdcSol ? "solana" : "ethereum-sepolia");

      const nearTxHash = await createNearIntent({
        id: intentId,
        paymentId: payment.id,
        destChain,
        destAsset,
        destAddress: payment.recipient,
        amountAtomic,
        decimals: destDecimals,
        zcashBurnTxid: payment.zcashBurnTxId || "",
        createdAt: Date.now(),
        fulfilled: false,
        payout_tx_hash: null,
      });

      console.log(`✓ NEAR intent posted: ${intentId}`);
      paymentStore.update(payment.id, {
        nearIntentId: intentId,
        // @ts-expect-error: extend payment with tx hash for UI explorer link
        nearIntentTxHash: nearTxHash,
        status: "INTENT_POSTED",
      });
      payment = paymentStore.get(payment.id)!;
    }

    // Step 4: Leave fulfillment to off-chain solver watching NEAR intents.
    // Solver will spend shielded ZEC and later mark the intent fulfilled.
  } catch (error) {
    console.error(`Error processing payment ${payment.id}:`, error);
    paymentStore.update(payment.id, {
      status: "ERROR",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Worker loop that processes pending payments
 */
export async function startWorker(intervalMs: number = 10000): Promise<void> {
  console.log(`Starting payment processor worker (interval: ${intervalMs}ms)`);

  const processLoop = async () => {
    try {
      // Process payments in various pending states
      const pendingStatuses = ["WAITING_FOR_FUNDING", "FUNDED"] as const;

      for (const status of pendingStatuses) {
        const payments = paymentStore.getByStatus(status);
        for (const payment of payments) {
          await processPayment(payment);
        }
      }
    } catch (error) {
      console.error("Error in worker loop:", error);
    }
  };

  // Run immediately
  await processLoop();

  // Then run periodically
  setInterval(processLoop, intervalMs);
}
