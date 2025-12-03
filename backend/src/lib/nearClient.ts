/**
 * NEAR Client for posting and managing payment intents
 *
 * This module handles posting payment intents to NEAR blockchain
 * where solvers can discover and fulfill them.
 */

export interface PaymentIntentPayload {
  id: string;
  paymentId: string;
  destChain: string; // e.g., "ethereum-sepolia" or "zcash-testnet"
  destAsset: string; // e.g., "ETH" or "ZEC"
  destAddress: string; // recipient address on destination chain
  amountWei: string; // amount in wei for ETH (reused here as atomic units)
  zcashBurnTxid: string;
  createdAt: number;
}

export interface NearIntentResponse extends PaymentIntentPayload {
  fulfilled: boolean;
  payoutTxHash?: string;
}

let nearContractId: string;
let nearAccountId: string;
const intentStore: NearIntentResponse[] = [];

/**
 * Initialize NEAR client
 */
export function initNearClient(contractId: string, accountId: string): void {
  nearContractId = contractId;
  nearAccountId = accountId;
}

/**
 * Create a payment intent on NEAR blockchain
 * Solvers will monitor these intents and fulfill them
 */
export async function createNearIntent(
  intent: PaymentIntentPayload
): Promise<void> {
  // TODO: Implement using near-api-js in production.
  intentStore.push({ ...intent, fulfilled: false });

  console.log(`[STUB] Creating NEAR intent:`, {
    intentId: intent.id,
    destChain: intent.destChain,
    destAddress: intent.destAddress,
    amountAtomic: intent.amountWei,
  });
}

/**
 * Fetch all open (unfulfilled) intents from NEAR
 */
export async function fetchOpenNearIntents(): Promise<PaymentIntentPayload[]> {
  // TODO: Implement using near-api-js in production.
  const open = intentStore.filter((i) => !i.fulfilled);
  console.log(`[STUB] Fetching open NEAR intents: ${open.length} pending`);
  return open.map(({ fulfilled: _f, payoutTxHash: _p, ...rest }) => rest);
}

/**
 * Mark an intent as fulfilled after solver completes the payout
 */
export async function markNearIntentFulfilled(
  id: string,
  payoutTxHash: string
): Promise<void> {
  // TODO: Implement using near-api-js in production.
  const target = intentStore.find((i) => i.id === id);
  if (target) {
    target.fulfilled = true;
    target.payoutTxHash = payoutTxHash;
  }

  console.log(`[STUB] Marking NEAR intent fulfilled:`, {
    intentId: id,
    payoutTxHash,
  });
}

/**
 * Get intent details by ID
 */
export async function getNearIntent(id: string): Promise<NearIntentResponse | null> {
  // TODO: Implement using near-api-js in production.
  console.log(`[STUB] Getting NEAR intent: ${id}`);
  const intent = intentStore.find((i) => i.id === id);
  return intent ? { ...intent } : null;
}
