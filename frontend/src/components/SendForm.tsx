import { FormEvent, useState } from "react";

export interface SendFormValues {
  recipient: string;
  amount: string;
  asset: "ETH" | "USDC" | "SOL" | "USDC_SOL";
  payAsset: "ETH" | "USDC" | "SOL" | "USDC_SOL";
}

interface Props {
  onSubmit: (values: SendFormValues) => Promise<void>;
  disabled?: boolean;
}

export function SendForm({ onSubmit, disabled }: Props) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("0.05");
  const [asset, setAsset] = useState<"ETH" | "USDC" | "SOL" | "USDC_SOL">("SOL");
  const [payAsset, setPayAsset] = useState<"ETH" | "USDC" | "SOL" | "USDC_SOL">("SOL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Static price map (USD) to mirror backend stub pricing
  const priceUsd = (symbol: string) => {
    switch (symbol) {
      case "USDC":
        return 1; // $1
      case "SOL":
        return 20; // $20
      default:
        return 3000; // ETH ~$3000
    }
  };

  const quote = (() => {
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) return null;
    const destSymbol = asset === "USDC_SOL" ? "USDC" : asset;
    const paySymbol = payAsset === "USDC_SOL" ? "USDC" : payAsset;
    const destUsd = priceUsd(destSymbol);
    const payUsd = priceUsd(paySymbol);
    const payAmount = (amt * destUsd) / payUsd;
    const payWithFee = payAmount * 1.001;
    const payFee = payWithFee - payAmount;
    return {
      payAmount,
      payWithFee,
      payFee,
      paySymbol,
      destAmount: amt,
      destSymbol,
    };
  })();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);
      await onSubmit({ recipient, amount, asset, payAsset });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <div className="field">
        <label className="label" htmlFor="pay-asset">
          Pay from
        </label>
        <select
          id="pay-asset"
          className="input"
          value={payAsset}
          onChange={(e) => setPayAsset(e.target.value as any)}
          disabled={disabled || loading}
        >
          <option value="ETH">Ξ  ETH (Ethereum)</option>
          <option value="USDC">$  USDC (Ethereum)</option>
          <option value="SOL">◎  SOL (Solana)</option>
          <option value="USDC_SOL">$  USDC (Solana)</option>
        </select>
      </div>

      <div className="field">
        <label className="label" htmlFor="recipient">
          Recipient ({asset === "SOL" || asset === "USDC_SOL" ? "Solana address" : "0x or ENS"})
        </label>
        <input
          id="recipient"
          className="input"
          placeholder={asset === "SOL" || asset === "USDC_SOL" ? "5Dg..." : "bob.eth"}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          required
          disabled={disabled || loading}
        />
      </div>

      <div
        className="field-row"
        style={{ display: "flex", gap: 12, alignItems: "flex-end" }}
      >
        <div className="field">
          <label className="label" htmlFor="asset">
            Asset to receive
          </label>
          <select
            id="asset"
            className="input"
            value={asset}
            onChange={(e) => setAsset(e.target.value as any)}
            disabled={disabled || loading}
          >
            <option value="ETH">Ξ  ETH (Ethereum)</option>
            <option value="USDC">$  USDC (Ethereum)</option>
            <option value="SOL">◎  SOL (Solana)</option>
            <option value="USDC_SOL">$  USDC (Solana)</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="label" htmlFor="amount">
            Amount to receive ({asset})
          </label>
          <input
            id="amount"
            className="input"
            type="number"
            step="0.0001"
            min="0.0001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            disabled={disabled || loading}
          />
        </div>
      </div>

      {error && <div className="badge">⚠️ {error}</div>}
      {quote && (
        <div className="muted stack" style={{ gap: 2 }}>
          <div>
            You will send{" "}
            <strong>
              {quote.payWithFee.toFixed(6)} {quote.paySymbol}
            </strong>{" "}
            (base {quote.payAmount.toFixed(6)} + fee {quote.payFee.toFixed(6)}).
          </div>
          <div>
            Destination will receive{" "}
            <strong>
              {quote.destAmount} {quote.destSymbol}
            </strong>
            .
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Shielding fee: 0.1% applied to the pay amount.
          </div>
        </div>
      )}

      <button className="button" type="submit" disabled={disabled || loading}>
        {loading ? "Opening wallet..." : "Send privately"}
      </button>
    </form>
  );
}
