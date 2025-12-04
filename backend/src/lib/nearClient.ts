/**
 * NEAR Client for posting and managing payment intents
 *
 * This module handles posting payment intents to NEAR blockchain
 * where solvers can discover and fulfill them.
 */

import { connect, keyStores, KeyPair, utils, Near, Account } from "near-api-js";
import { NearConfig } from "near-api-js/lib/near";

export interface PaymentIntentPayload {
  id: string;
  paymentId: string;
  destChain: string; // e.g., "ethereum-sepolia" or "zcash-testnet"
  destAsset: string; // e.g., "ETH" or "ZEC"
  destAddress: string; // recipient address on destination chain
  amountAtomic: string; // amount in smallest unit for destAsset
  decimals: number; // decimal places for destAsset
  zcashBurnTxid: string;
  createdAt: number;
  fulfilled?: boolean;
  payout_tx_hash?: string | null;
}

export interface NearIntentResponse extends PaymentIntentPayload {
  fulfilled: boolean;
  payoutTxHash?: string;
}

type NearClientConfig = {
  contractId: string;
  accountId: string;
  privateKey?: string;
  networkId: string;
  nodeUrl: string;
};

let nearConfig: NearClientConfig;
let nearConnection: Near | null = null;
let nearAccount: Account | null = null;
const intentStore: NearIntentResponse[] = [];

/**
 * Initialize NEAR client (prefers real connection; falls back to stub store if misconfigured)
 */
export async function initNearClient(
  contractId: string,
  accountId: string,
  privateKey?: string,
  nodeUrl: string = "https://rpc.testnet.near.org",
  networkId: string = "testnet"
): Promise<void> {
  nearConfig = { contractId, accountId, privateKey, nodeUrl, networkId };

  if (!privateKey) {
    console.warn(
      "[NEAR] NEAR_PRIVATE_KEY not set; using in-memory stub for intents."
    );
    return;
  }

  const keyStore = new keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(privateKey);
  await keyStore.setKey(networkId, accountId, keyPair);

  const config: NearConfig = {
    headers: {},
    keyStore,
    networkId,
    nodeUrl,
    walletUrl: "",
    helperUrl: "",
  };

  nearConnection = await connect(config);
  nearAccount = await nearConnection.account(accountId);
  console.log(`[NEAR] Connected to ${networkId} with account ${accountId}`);
}

/**
 * Create a payment intent on NEAR blockchain
 * Solvers will monitor these intents and fulfill them
 */
export async function createNearIntent(
  intent: PaymentIntentPayload
): Promise<void> {
  if (!nearAccount || !nearConfig.privateKey) {
    // Stub fallback
    intentStore.push({ ...intent, fulfilled: false });
    console.log(`[STUB] Creating NEAR intent:`, {
      intentId: intent.id,
      destChain: intent.destChain,
      destAddress: intent.destAddress,
      amountAtomic: intent.amountAtomic,
    });
    return;
  }

  const contractIntent = {
    id: intent.id,
    payment_id: intent.paymentId,
    dest_chain: intent.destChain,
    dest_asset: intent.destAsset,
    dest_address: intent.destAddress,
    amount_atomic: intent.amountAtomic?.toString() ?? "0",
    decimals: Number(intent.decimals ?? 0),
    zcash_burn_txid: intent.zcashBurnTxid,
    created_at: intent.createdAt?.toString() ?? "0",
    fulfilled: intent.fulfilled ?? false,
    payout_tx_hash: intent.payout_tx_hash ?? null,
  };

  console.log("[NEAR] Sending intent payload", contractIntent);

  await nearAccount.functionCall({
    contractId: nearConfig.contractId,
    methodName: "create_intent",
    args: { intent: contractIntent },
    gas: BigInt("30000000000000"), // 30 Tgas
  });

  console.log(`[NEAR] Intent created on-chain: ${intent.id}`);
}

/**
 * Fetch all open (unfulfilled) intents from NEAR
 */
export async function fetchOpenNearIntents(): Promise<PaymentIntentPayload[]> {
  if (!nearAccount || !nearConfig.privateKey) {
    const open = intentStore.filter((i) => !i.fulfilled);
    console.log(`[STUB] Fetching open NEAR intents: ${open.length} pending`);
    return open.map(({ fulfilled: _f, payoutTxHash: _p, ...rest }) => rest);
  }

  const result = await nearAccount.viewFunction({
    contractId: nearConfig.contractId,
    methodName: "list_open_intents",
    args: {},
  });

  return result as PaymentIntentPayload[];
}

/**
 * Mark an intent as fulfilled after solver completes the payout
 */
export async function markNearIntentFulfilled(
  id: string,
  payoutTxHash: string
): Promise<void> {
  if (!nearAccount || !nearConfig.privateKey) {
    const target = intentStore.find((i) => i.id === id);
    if (target) {
      target.fulfilled = true;
      target.payoutTxHash = payoutTxHash;
    }

    console.log(`[STUB] Marking NEAR intent fulfilled:`, {
      intentId: id,
      payoutTxHash,
    });
    return;
  }

  await nearAccount.functionCall({
    contractId: nearConfig.contractId,
    methodName: "mark_fulfilled",
    args: { id, payout_tx_hash: payoutTxHash },
    gas: BigInt("30000000000000"), // 30 Tgas
  });

  console.log(`[NEAR] Intent ${id} marked fulfilled on-chain`);
}

/**
 * Get intent details by ID
 */
export async function getNearIntent(id: string): Promise<NearIntentResponse | null> {
  if (!nearAccount || !nearConfig.privateKey) {
    console.log(`[STUB] Getting NEAR intent: ${id}`);
    const intent = intentStore.find((i) => i.id === id);
    return intent ? { ...intent } : null;
  }

  const intent = await nearAccount.viewFunction({
    contractId: nearConfig.contractId,
    methodName: "get_intent",
    args: { id },
  });

  return intent as NearIntentResponse;
}
