import fetch from "node-fetch";
import { parseUnits } from "ethers";
import { ZcashLightClient, setLightClient } from "./zcashClient";

/**
 * Minimal HTTP wrapper around an external Rust lightwalletd client service.
 * The Rust sidecar should expose a POST /send-shielded-tx endpoint that
 * accepts { toAddress, amountZec, memo? } and returns { txId }.
 */
export function registerHttpLightClient(
  baseUrl: string,
  apiKey?: string
): void {
  const client: ZcashLightClient = {
    async sendShieldedTx({ toAddress, amountZec, memo }) {
      const amountZatBig = parseUnits(amountZec, 8);
      // sidecar expects a u64; for small test amounts this fits in a JS number
      const amountZat =
        amountZatBig <= BigInt(Number.MAX_SAFE_INTEGER)
          ? Number(amountZatBig)
          : amountZatBig.toString();
      const res = await fetch(`${baseUrl}/send-shielded-tx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        // Sidecar is expected to read its own seed/spending key from env; no secrets sent over HTTP.
        body: JSON.stringify({ toAddress, amountZec, amountZat, memo }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `Light client send failed: ${res.status} ${res.statusText} ${body}`
        );
      }

      const json = (await res.json()) as { txId: string };
      if (!json.txId) {
        throw new Error("Light client response missing txId");
      }
      return json.txId;
    },
  };

  setLightClient(client);
  console.log("[ZEC] Registered HTTP light client wrapper");
}
