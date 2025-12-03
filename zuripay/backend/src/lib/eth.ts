import { ethers } from "ethers";

let provider: ethers.JsonRpcProvider;
let collectorAddress: string;
let solverWallet: ethers.Wallet | null = null;

/**
 * Initialize Ethereum client for monitoring deposits to EOA/contract
 */
export function initEthClient(
  rpcUrl: string,
  collectorAddr: string,
  solverPrivateKey?: string
): void {
  provider = new ethers.JsonRpcProvider(rpcUrl);
  collectorAddress = collectorAddr;

  if (solverPrivateKey) {
    solverWallet = new ethers.Wallet(solverPrivateKey, provider);
  }
}

export function getCollectorAddress(): string {
  if (!collectorAddress) {
    throw new Error("ETH client not initialized");
  }
  return collectorAddress;
}

export function getSolverAddress(): string | undefined {
  return solverWallet?.address;
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

/**
 * Send payout from solver wallet to recipient.
 */
export async function sendPayoutEth(
  recipient: string,
  amountEth: string
): Promise<string> {
  if (!solverWallet) {
    throw new Error("Solver wallet not configured");
  }

  const tx = await solverWallet.sendTransaction({
    to: recipient,
    value: ethers.parseEther(amountEth),
  });

  await tx.wait();
  return tx.hash;
}
