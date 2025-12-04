import fetch from "node-fetch";
import { ZcashLightClient, setLightClient } from "./zcashClient";

/**
 * Minimal HTTP wrapper around an external Rust lightwalletd client service.
 * The Rust sidecar should expose a POST /send-shielded-tx endpoint that
 * accepts { toAddress, amountZec, memo? } and returns { txId }.
 */
export function registerHttpLightClient(
  baseUrl: string,
  apiKey?: string,
  spendingKey?: string
): void {
  const client: ZcashLightClient = {
    async sendShieldedTx({ toAddress, amountZec, memo }) {
      const res = await fetch(`${baseUrl}/send-shielded-tx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        // Pass spendingKey (mnemonic) so the sidecar can derive the USK internally.
        body: JSON.stringify({ toAddress, amountZec, memo, spendingKey }),
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
