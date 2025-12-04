/**
 * Zcash Client for burning and sending shielded ZEC via lightwalletd.
 *
 * NOTE: This file now targets a light client flow (lightwalletd + SDK)
 * instead of a full zcashd node. The calls are stubbed until you wire
 * in a lightwalletd-aware library (e.g., zcash-light-client-ffi).
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

type ZcashLightClientConfig = {
  endpoint: string;
  viewingKey?: string;
  spendingKey?: string;
  burnAddress?: string;
};

const lightClientConfig: ZcashLightClientConfig | null = process.env.LIGHTWALLETD_ENDPOINT
  ? {
      endpoint: process.env.LIGHTWALLETD_ENDPOINT!,
      viewingKey: process.env.ZCASH_VIEWING_KEY,
      spendingKey: process.env.ZCASH_SPENDING_KEY,
      burnAddress: process.env.ZCASH_BURN_ADDRESS,
    }
  : null;

/**
 * Interface you can implement with a real light client SDK wrapper.
 */
export interface ZcashLightClient {
  sendShieldedTx(params: {
    toAddress: string;
    amountZec: string;
    memo?: string;
    spendingKey?: string;
  }): Promise<string>; // returns tx id
}

let externalLightClient: ZcashLightClient | null = null;

/**
 * Provide a concrete light client implementation (e.g., zcash-light-client-ffi wrapper).
 */
export function setLightClient(client: ZcashLightClient) {
  externalLightClient = client;
}

function isLightwalletdConfigured(): boolean {
  return Boolean(lightClientConfig && lightClientConfig.endpoint);
}

/**
 * Burn shielded ZEC to provide privacy for the payment
 * In production, this would:
 * 1. Send a shielded tx from app's Zcash wallet to a burn address
 * 2. Use Zcash SDK or CLI wrapper (zcash-cli, lightwalletd)
 *
 * For MVP, this is stubbed but maintains the correct interface
 */
export async function burnZecForPayment(
  paymentId: string,
  amountZec: string
): Promise<ZcashBurnResult> {
  if (!isLightwalletdConfigured()) {
    console.log(
      `[STUB] Burning ${amountZec} ZEC for payment ${paymentId} (lightwalletd not configured)`
    );
    return {
      txId: `zcash-testnet-burn-${paymentId}-${Date.now()}`,
      amountZec,
      timestamp: Date.now(),
    };
  }

  // If an external light client is registered, use it.
  if (externalLightClient && lightClientConfig?.burnAddress) {
    const txId = await externalLightClient.sendShieldedTx({
      toAddress: lightClientConfig.burnAddress,
      amountZec,
      memo: `burn:${paymentId}`,
    });
    return {
      txId,
      amountZec,
      timestamp: Date.now(),
    };
  }

  console.log(
    `[STUB] Would send burn via lightwalletd ${lightClientConfig?.endpoint} to ${lightClientConfig?.burnAddress}`
  );

  return {
    txId: `zcash-lightwalletd-burn-${paymentId}-${Date.now()}`,
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
  if (!isLightwalletdConfigured()) {
    console.log(
      `[STUB] Sending shielded payout of ${amountZec} ZEC to ${toAddress} (lightwalletd not configured)`
    );
    return {
      txId: `zcash-shielded-payout-${Date.now()}`,
      amountZec,
      toAddress,
      timestamp: Date.now(),
    };
  }

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

  console.log(
    `[STUB] Would send shielded payout via lightwalletd ${lightClientConfig?.endpoint} to ${toAddress} for ${amountZec} ZEC`
  );

  return {
    txId: `zcash-lightwalletd-payout-${Date.now()}`,
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
