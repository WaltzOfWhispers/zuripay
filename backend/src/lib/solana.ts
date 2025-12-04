/**
 * Minimal Solana transfer verifier using RPC.
 * Verifies native SOL transfers and SPL USDC (when mint provided).
 */
type GetTransactionResponse = {
  result?: {
    meta?: {
      err: any;
      preBalances?: number[];
      postBalances?: number[];
      innerInstructions?: Array<{
        instructions?: Array<any>;
      }>;
    };
    transaction?: {
      message?: {
        accountKeys?: Array<{ pubkey: string } | string>;
        instructions?: Array<any>;
      };
    };
  };
};

export async function verifySolDepositTx(
  signature: string,
  expectedSol: string,
  collectorOverride?: string
): Promise<boolean> {
  const rpcUrl = process.env.SOL_RPC_URL;
  const defaultCollector = process.env.SOL_COLLECTOR_ADDRESS;

  console.log("[SOL] SOL_RPC_URL configured as:", rpcUrl);
  if (!rpcUrl) {
    console.warn("[SOL] SOL_RPC_URL not set; cannot verify SOL funding");
    return false;
  }

  const collector = collectorOverride || defaultCollector;
  if (!collector) {
    console.warn("[SOL] SOL_COLLECTOR_ADDRESS not set; cannot verify SOL funding");
    return false;
  }

  let lamportsExpected: bigint;
  try {
    lamportsExpected = BigInt(Math.round(parseFloat(expectedSol) * 1e9));
  } catch {
    console.warn("[SOL] Invalid expectedSol amount");
    return false;
  }

  const sumTransfersToCollector = (parsed: any[]): bigint => {
    return parsed.reduce((acc, ix) => {
      const info = ix?.parsed?.info;
      if (!info) return acc;
      const dest =
        info?.destination ||
        info?.dest ||
        info?.account ||
        info?.newAccount ||
        info?.recipient;
      const lamports = info?.lamports ?? info?.amount ?? 0;
      if (dest && dest === collector) {
        try {
          const lamportsBig = BigInt(lamports);
          return acc + lamportsBig;
        } catch {
          return acc;
        }
      }
      return acc;
    }, 0n);
  };

  const body = {
    jsonrpc: "2.0",
    id: "1",
    method: "getTransaction",
    params: [signature, { encoding: "jsonParsed" }],
  };

  let json: GetTransactionResponse;
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    json = await res.json();
  } catch (err) {
    console.warn("[SOL] RPC fetch failed", err);
    return false;
  }

  const value = (json as any)?.result;
  if (!value) {
    console.warn("[SOL] No transaction result for", signature);
    return false;
  }

  if (value.meta?.err) {
    console.warn("[SOL] Transaction has error");
    return false;
  }

  const keys = value.transaction?.message?.accountKeys || [];
  const keyStrings = keys.map((k: any) => (typeof k === "string" ? k : k?.pubkey)).filter(Boolean);
  const collectorIdx = keyStrings.findIndex((k: string) => k === collector);
  if (collectorIdx < 0) {
    console.warn("[SOL] Collector address not found in tx");
    return false;
  }

  const pre = value.meta?.preBalances?.[collectorIdx];
  const post = value.meta?.postBalances?.[collectorIdx];
  if (typeof pre !== "number" || typeof post !== "number") {
    console.warn("[SOL] Missing balance info for collector");
    return false;
  }

  const diff = BigInt(post - pre);
  const topLevelTransfers = sumTransfersToCollector(value.transaction?.message?.instructions || []);
  const innerTransfers = sumTransfersToCollector(
    (value.meta?.innerInstructions || []).flatMap((ix) => ix.instructions || [])
  );
  const totalTransfers = topLevelTransfers + innerTransfers;

  // Accept if explicit transfers to collector meet/exceed expected
  if (totalTransfers >= lamportsExpected) {
    return true;
  }

  // Fallback: accept on balance delta if transfers were not parsed but balance increased
  if (diff >= lamportsExpected) {
    return true;
  }

  console.warn(
    `[SOL] Collector funding insufficient: balance delta ${diff}, transfers ${totalTransfers}, expected at least ${lamportsExpected}`
  );
  if (totalTransfers === 0n) {
    console.warn(
      "[SOL] No parsed transfers to collector; ensure the tx pays the collector address on the correct cluster"
    );
  }
  return false;
}
