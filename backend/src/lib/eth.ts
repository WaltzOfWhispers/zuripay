import { ethers } from "ethers";

let provider: ethers.JsonRpcProvider;
let collectorAddress: string;

/**
 * Initialize Ethereum client for monitoring deposits to EOA/contract
 */
export function initEthClient(
  rpcUrl: string,
  collectorAddr: string
): void {
  provider = new ethers.JsonRpcProvider(rpcUrl);
  collectorAddress = collectorAddr;
}

export function getCollectorAddress(): string {
  if (!collectorAddress) {
    throw new Error("ETH client not initialized");
  }
  return collectorAddress;
}

/**
 * Monitor and verify that a deposit transaction was confirmed
 * This checks that user's MetaMask transfer went through successfully
 */
export async function verifyDepositTx(
  txHash: string,
  expectedAmount: string
): Promise<boolean> {
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx) return false;

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return false;

    // Check transaction is confirmed
    if (receipt.status !== 1) return false;

    // Verify recipient is our collector address (EOA or contract)
    const recipientMatch =
      tx.to?.toLowerCase() === collectorAddress.toLowerCase();

    // Verify amount matches (with small tolerance for rounding)
    const actualAmount = ethers.formatEther(tx.value);
    const expectedAmountNum = parseFloat(expectedAmount);
    const actualAmountNum = parseFloat(actualAmount);
    const amountMatch = Math.abs(actualAmountNum - expectedAmountNum) < 0.0001;

    return recipientMatch && amountMatch;
  } catch (error) {
    console.error("Error verifying deposit tx:", error);
    return false;
  }
}

/**
 * Get transaction details
 */
export async function getTransactionDetails(txHash: string) {
  const tx = await provider.getTransaction(txHash);
  const receipt = await provider.getTransactionReceipt(txHash);
  return { tx, receipt };
}

/**
 * Get ETH balance for an address
 */
export async function getEthBalance(address: string): Promise<string> {
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}
