import { ethers } from "ethers";
import {
  fetchOpenNearIntents,
  markNearIntentFulfilled,
} from "./lib/nearClient";
import { sendShieldedPayout } from "./lib/zcashClient";
import { paymentStore } from "./models/payment";

/**
 * Solver daemon:
 * - Polls NEAR intents
 * - Spends from shielded ZEC balance (stubbed) to fulfill payouts
 * - Marks intents fulfilled on NEAR (stubbed) and updates local payment store
 */
export async function startSolver(intervalMs: number = 10000): Promise<void> {
  console.log(`Starting solver loop (interval: ${intervalMs}ms)`);

  const loop = async () => {
    try {
      const intents = await fetchOpenNearIntents();
      for (const intent of intents) {
        console.log(
          `Solver picked intent ${intent.id} -> ${intent.destAddress} (${intent.destChain} ${intent.destAsset})`
        );

        // Interpret amountWei as atomic units; convert to human-readable for logging
        const amountZec = ethers.formatEther(intent.amountWei);

        // Send shielded payout (stub)
        const payout = await sendShieldedPayout(intent.destAddress, amountZec);

        // Mark on NEAR (stub) as fulfilled
        await markNearIntentFulfilled(intent.id, payout.txId);

        // Update local payment store if present
        const payment = paymentStore.get(intent.paymentId);
        if (payment) {
          paymentStore.update(payment.id, {
            payoutTxHash: payout.txId,
            status: "PAID",
          });
        }

        console.log(
          `✓ Intent ${intent.id} fulfilled with shielded payout tx ${payout.txId}`
        );
      }
    } catch (err) {
      console.error("Solver loop error:", err);
    }
  };

  // Run immediately then on interval
  await loop();
  setInterval(loop, intervalMs);
}
