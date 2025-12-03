import { FormEvent, useState } from "react";

export interface SendFormValues {
  recipient: string;
  amountEth: string;
}

interface Props {
  onSubmit: (values: SendFormValues) => Promise<void>;
  disabled?: boolean;
}

export function SendForm({ onSubmit, disabled }: Props) {
  const [recipient, setRecipient] = useState("");
  const [amountEth, setAmountEth] = useState("0.05");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);
      await onSubmit({ recipient, amountEth });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <div className="field">
        <label className="label" htmlFor="recipient">
          Recipient (0x or ENS)
        </label>
        <input
          id="recipient"
          className="input"
          placeholder="bob.eth"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          required
          disabled={disabled || loading}
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="amount">
          Amount (ETH)
        </label>
        <input
          id="amount"
          className="input"
          type="number"
          step="0.0001"
          min="0.0001"
          value={amountEth}
          onChange={(e) => setAmountEth(e.target.value)}
          required
          disabled={disabled || loading}
        />
      </div>

      {error && <div className="badge">⚠️ {error}</div>}

      <button className="button" type="submit" disabled={disabled || loading}>
        {loading ? "Opening wallet..." : "Send privately"}
      </button>
    </form>
  );
}
