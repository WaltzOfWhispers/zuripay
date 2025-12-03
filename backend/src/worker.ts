import { randomUUID } from "crypto";
import { Payment, paymentStore } from "./models/payment";
import { verifyDepositTx } from "./lib/eth";
import { burnZecForPayment } from "./lib/zcashClient";
import { createNearIntent } from "./lib/nearClient";
import { ethers } from "ethers";

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

    // Step 1: Verify funding transaction
    if (payment.status === "WAITING_FOR_FUNDING") {
      if (!payment.fundingTxHash) {
        console.log(`Payment ${payment.id} has no funding tx yet`);
        return;
      }

      const confirmed = await verifyDepositTx(
        payment.fundingTxHash,
        payment.amountEth
      );

      if (!confirmed) {
        console.log(`Payment ${payment.id} funding not confirmed yet`);
        return;
      }

      console.log(`✓ Payment ${payment.id} funding confirmed`);
      paymentStore.update(payment.id, { status: "FUNDED" });
      payment = paymentStore.get(payment.id)!;
    }

    // Step 2: Burn ZEC for privacy
    if (payment.status === "FUNDED") {
      console.log(`Burning ZEC for payment ${payment.id}`);

      // Convert ETH amount to ZEC (simplified 1:1 for demo)
      const amountZec = payment.amountEth;

      const burnResult = await burnZecForPayment(payment.id, amountZec);

      console.log(`✓ ZEC burned: ${burnResult.txId}`);
      paymentStore.update(payment.id, {
        zcashBurnTxId: burnResult.txId,
        status: "ZEC_BURNED",
      });
      payment = paymentStore.get(payment.id)!;
    }

    // Step 3: Post NEAR intent for solvers
    if (payment.status === "ZEC_BURNED") {
      const intentId = randomUUID();

      console.log(`Posting NEAR intent for payment ${payment.id}`);

      await createNearIntent({
        id: intentId,
        paymentId: payment.id,
        destChain: "ethereum-sepolia",
        destAsset: "ETH",
        destAddress: payment.recipient,
        amountWei: ethers.parseEther(payment.amountEth).toString(),
        zcashBurnTxid: payment.zcashBurnTxId!,
        createdAt: Date.now(),
      });

      console.log(`✓ NEAR intent posted: ${intentId}`);
      paymentStore.update(payment.id, {
        nearIntentId: intentId,
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
      const pendingStatuses = [
        "WAITING_FOR_FUNDING",
        "FUNDED",
        "ZEC_BURNED",
      ] as const;

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
