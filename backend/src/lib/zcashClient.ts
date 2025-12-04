/**
 * Zcash Client for burning/collecting and sending shielded ZEC.
 *
 * This repo does NOT run lightwalletd or zcashd. The only real path is via an
 * externally registered light client (e.g., the HTTP sidecar). If none is
 * registered, we return stubbed responses.
 */

export interface ZcashBurnResult {
  txId: string;
  amountZec: string;
  timestamp: number;
}

export interface ZcashPayoutResult {
  txId: string;
  amountZec: string;
  toAddress: string;
  timestamp: number;
}

/**
 * Interface you can implement with a real light client SDK wrapper.
 */
export interface ZcashLightClient {
  sendShieldedTx(params: {
    toAddress: string;
    amountZec: string;
    amountZat?: string;
    memo?: string;
    spendingKey?: string;
  }): Promise<string>; // returns tx id
}

let externalLightClient: ZcashLightClient | null = null;
const collectAddress = process.env.ZCASH_COLLECT_ADDRESS;

/**
 * Provide a concrete light client implementation (e.g., zcash-light-client-ffi wrapper).
 */
export function setLightClient(client: ZcashLightClient) {
  externalLightClient = client;
}

/**
 * Burn shielded ZEC to provide privacy for the payment
 * In production, this would:
 * 1. Send a shielded tx from app's Zcash wallet to a burn address
 * 2. Use a Zcash light client SDK/sidecar to broadcast
 *
 * For MVP, this is stubbed but maintains the correct interface
 */
export async function burnZecForPayment(
  paymentId: string,
  amountZec: string
): Promise<ZcashBurnResult> {
  // If an external light client is registered, use it.
  if (externalLightClient && collectAddress) {
    const txId = await externalLightClient.sendShieldedTx({
      toAddress: collectAddress,
      amountZec,
      memo: `burn:${paymentId}`,
    });
    return {
      txId,
      amountZec,
      timestamp: Date.now(),
    };
  }

  // Stub path
  console.log(
    `[STUB] Burning/collecting ${amountZec} ZEC for payment ${paymentId} (no external light client configured)`
  );
  return {
    txId: `zcash-testnet-burn-${paymentId}-${Date.now()}`,
    amountZec,
    timestamp: Date.now(),
  };
}

/**
 * Send shielded payout from app's ZEC balance.
 * This is stubbed for now; real implementation would craft and broadcast
 * a shielded transaction to the destination address.
 */
export async function sendShieldedPayout(
  toAddress: string,
  amountZec: string
): Promise<ZcashPayoutResult> {
  if (externalLightClient) {
    const txId = await externalLightClient.sendShieldedTx({
      toAddress,
      amountZec,
      memo: "payout",
    });
    return {
      txId,
      amountZec,
      toAddress,
      timestamp: Date.now(),
    };
  }

  return {
    txId: `zcash-shielded-payout-${Date.now()}`,
    amountZec,
    toAddress,
    timestamp: Date.now(),
  };
}

/**
 * Verify a Zcash burn transaction was confirmed
 */
export async function verifyZecBurnTx(txId: string): Promise<boolean> {
  // TODO: Implement verification using Zcash node
  console.log(`[STUB] Verifying ZEC burn tx: ${txId}`);
  return true;
}

/**
 * Get shielded balance of app's Zcash wallet
 */
export async function getShieldedBalance(): Promise<string> {
  // TODO: Implement using Zcash SDK
  console.log(`[STUB] Getting shielded ZEC balance`);
  return "10.0"; // Stub balance
}
