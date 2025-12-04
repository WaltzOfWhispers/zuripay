import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

type SendSolParams = {
  to: string;
  amountSol: string;
  rpcUrl: string;
};

/**
 * Send native SOL using the injected Solana wallet (e.g., Phantom).
 * Returns the signature on success.
 */
export async function sendSol({ to, amountSol, rpcUrl }: SendSolParams): Promise<string> {
  const provider = (window as any).solana;
  if (!provider) {
    throw new Error("No Solana wallet found. Open Phantom or another Solana wallet.");
  }

  const networkUrl = rpcUrl.toLowerCase();
  const cluster =
    networkUrl.includes("devnet") ? "devnet" : networkUrl.includes("testnet") ? "testnet" : "mainnet-beta";

  // Do not force-switch networks; rely on wallet setting (ask user to pick Devnet manually)

  // Request connect if needed
  await provider.connect?.();

  const connection = new Connection(rpcUrl, "confirmed");
  let fromPubkey: PublicKey;
  let toPubkey: PublicKey;
  try {
    fromPubkey = new PublicKey(provider.publicKey?.toString() || (await provider.connect()).publicKey);
    toPubkey = new PublicKey(to.trim());
  } catch (err) {
    throw new Error("Invalid Solana address for sender or collector");
  }
  const lamportsNum = Math.round(parseFloat(amountSol) * 1e9);
  if (!isFinite(lamportsNum) || lamportsNum <= 0) {
    throw new Error("Invalid SOL amount to send");
  }
  const lamports = BigInt(lamportsNum);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");

  const tx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: fromPubkey,
  }).add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports,
    })
  );

  // Phantom/solana wallets support signAndSendTransaction or signTransaction.
  let signature: string;
  if (provider.signAndSendTransaction) {
    const res = await provider.signAndSendTransaction(tx);
    signature = res?.signature || res?.signature?.signature || res;
  } else if (provider.sendTransaction) {
    // Some wallets expose sendTransaction(transaction, connection)
    signature = await provider.sendTransaction(tx, connection, { maxRetries: 3 });
  } else {
    throw new Error("Wallet does not support sending Solana transactions");
  }

  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

  return signature;
}
