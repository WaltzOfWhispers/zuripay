/**
 * NEAR Client for posting and managing payment intents
 *
 * This module handles posting payment intents to NEAR blockchain
 * where solvers can discover and fulfill them.
 */

export interface PaymentIntentPayload {
  id: string;
  paymentId: string;
  destChain: string; // e.g., "ethereum-sepolia"
  destAsset: string; // e.g., "ETH"
  destAddress: string; // recipient address
  amountWei: string; // amount in wei for ETH
  zcashBurnTxid: string;
  createdAt: number;
}

export interface NearIntentResponse {
  id: string;
  fulfilled: boolean;
  payoutTxHash?: string;
}

let nearContractId: string;
let nearAccountId: string;

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
  // TODO: Implement using near-api-js
  // Example implementation:
  // const account = await near.account(nearAccountId);
  // await account.functionCall({
  //   contractId: nearContractId,
  //   methodName: "create_intent",
  //   args: intent,
  // });

  console.log(`[STUB] Creating NEAR intent:`, {
    intentId: intent.id,
    destChain: intent.destChain,
    destAddress: intent.destAddress,
    amount: intent.amountWei,
  });
}

/**
 * Fetch all open (unfulfilled) intents from NEAR
 */
export async function fetchOpenNearIntents(): Promise<PaymentIntentPayload[]> {
  // TODO: Implement using near-api-js
  // const account = await near.account(nearAccountId);
  // const result = await account.viewFunction({
  //   contractId: nearContractId,
  //   methodName: "list_open_intents",
  // });
  // return result;

  console.log(`[STUB] Fetching open NEAR intents`);
  return [];
}

/**
 * Mark an intent as fulfilled after solver completes the payout
 */
export async function markNearIntentFulfilled(
  id: string,
  payoutTxHash: string
): Promise<void> {
  // TODO: Implement using near-api-js
  // const account = await near.account(nearAccountId);
  // await account.functionCall({
  //   contractId: nearContractId,
  //   methodName: "mark_fulfilled",
  //   args: { id, payout_tx_hash: payoutTxHash },
  // });

  console.log(`[STUB] Marking NEAR intent fulfilled:`, {
    intentId: id,
    payoutTxHash,
  });
}

/**
 * Get intent details by ID
 */
export async function getNearIntent(id: string): Promise<NearIntentResponse | null> {
  // TODO: Implement using near-api-js
  console.log(`[STUB] Getting NEAR intent: ${id}`);
  return null;
}
