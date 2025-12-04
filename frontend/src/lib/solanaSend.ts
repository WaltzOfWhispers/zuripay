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
  const fromPubkey = new PublicKey(provider.publicKey?.toString() || (await provider.connect()).publicKey);
  const toPubkey = new PublicKey(to.trim());
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

/**
 * Send SPL USDC (decimals=6) on Solana to the collector via Phantom-compatible wallet.
 */
export async function sendUsdcSol(params: {
  to: string;
  amountUsdc: string;
  rpcUrl: string;
  mint: string;
}): Promise<string> {
  const { to, amountUsdc, rpcUrl, mint } = params;
  const provider = (window as any).solana;
  if (!provider) {
    throw new Error("No Solana wallet found. Open Phantom or another Solana wallet.");
  }

  await provider.connect?.();
  const connection = new Connection(rpcUrl, "confirmed");
  const fromPubkey = new PublicKey(provider.publicKey?.toString() || (await provider.connect()).publicKey);
  const toPubkey = new PublicKey(to.trim());
  const mintPubkey = new PublicKey(mint.trim());

  const amountRawNum = Math.round(parseFloat(amountUsdc) * 1_000_000);
  if (!isFinite(amountRawNum) || amountRawNum <= 0) {
    throw new Error("Invalid USDC amount to send");
  }
  const amountRaw = BigInt(amountRawNum);

  // Derive associated token accounts
  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1ZAGyDuzmvnbuZwV8sYwxRkXpZTa");

  const getAta = async (owner: PublicKey) => {
    const [ata] = PublicKey.findProgramAddressSync(
      [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return ata;
  };

  const fromAta = await getAta(fromPubkey);
  const toAta = await getAta(toPubkey);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");

  // SPL token transfer instruction (raw layout for instruction 3)
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0); // Transfer instruction
  data.writeBigInt64LE(amountRaw, 1);

  const ix = {
    keys: [
      { pubkey: fromAta, isSigner: false, isWritable: true },
      { pubkey: toAta, isSigner: false, isWritable: true },
      { pubkey: fromPubkey, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  };

  const tx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: fromPubkey,
  }).add(ix);

  let signature: string;
  if (provider.signAndSendTransaction) {
    const res = await provider.signAndSendTransaction(tx);
    signature = res?.signature || res?.signature?.signature || res;
  } else if (provider.sendTransaction) {
    signature = await provider.sendTransaction(tx, connection, { maxRetries: 3 });
  } else {
    throw new Error("Wallet does not support sending Solana transactions");
  }

  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}
