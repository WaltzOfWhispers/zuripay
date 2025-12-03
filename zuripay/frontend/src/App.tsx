import { useEffect, useMemo, useState } from "react";
import {
  Payment,
  attachFundingTx,
  createPaymentIntent,
  fetchPaymentStatus,
} from "./lib/api";
import { resolveRecipient, sendEth, getConnectedAddress } from "./lib/eth";
import { SendForm, SendFormValues } from "./components/SendForm";
import { StatusTimeline } from "./components/StatusTimeline";

function App() {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [collectorAddress, setCollectorAddress] = useState<string>();
  const [amountWithFee, setAmountWithFee] = useState<string>();
  const [fundingTxHash, setFundingTxHash] = useState<string>();
  const [payoutTxHash, setPayoutTxHash] = useState<string>();
  const [resolvedRecipient, setResolvedRecipient] = useState<string>();
  const [walletAddress, setWalletAddress] = useState<string>();
  const [polling, setPolling] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getConnectedAddress()
      .then((addr) => setWalletAddress(addr))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!payment?.id || !polling) return;

    const interval = setInterval(async () => {
      try {
        const latest = await fetchPaymentStatus(payment.id);
        setPayment(latest);
        setFundingTxHash(latest.fundingTxHash);
        setPayoutTxHash(latest.payoutTxHash);

        if (latest.status === "PAID" || latest.status === "ERROR") {
          setPolling(false);
          setStatusMessage(
            latest.status === "PAID"
              ? "Payout completed"
              : "There was an issue processing your payment"
          );
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [payment?.id, polling]);

  const handleSubmit = async ({ recipient, amountEth }: SendFormValues) => {
    setBusy(true);
    setError(null);
    setStatusMessage("Resolving recipient...");

    try {
      const resolved = await resolveRecipient(recipient);
      setResolvedRecipient(resolved);

      setStatusMessage("Creating payment intent...");
      const intent = await createPaymentIntent({
        recipient: resolved,
        amountEth,
      });

      setCollectorAddress(intent.collectorAddress);
      setAmountWithFee(intent.amountEthWithFee);

      const newPayment: Payment = {
        id: intent.paymentId,
        recipient: resolved,
        amountEth,
        collectorAddress: intent.collectorAddress,
        status: "CREATED",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setPayment(newPayment);

      setStatusMessage("Please confirm the funding transaction in your wallet...");
      const txHash = await sendEth({
        to: intent.collectorAddress,
        amountEth: intent.amountEthWithFee,
      });

      setFundingTxHash(txHash);
      setStatusMessage("Funding sent. Notifying backend...");

      await attachFundingTx({
        paymentId: intent.paymentId,
        fundingTxHash: txHash,
      });

      setStatusMessage("Waiting for confirmations...");
      setPayment((prev) =>
        prev
          ? {
              ...prev,
              fundingTxHash: txHash,
              status: "WAITING_FOR_FUNDING",
            }
          : prev
      );
      setPolling(true);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to start payment");
    } finally {
      setBusy(false);
    }
  };

  const statusCard = useMemo(() => {
    if (!payment) return null;
    return (
      <div className="card status-card">
        <div className="pill">Payment status</div>
        <h3 style={{ marginBottom: 8, marginTop: 12 }}>
          {payment.amountEth} ETH → {resolvedRecipient ?? payment.recipient}
        </h3>
        <div className="muted" style={{ marginBottom: 12 }}>
          Payment ID: <code>{payment.id}</code>
        </div>
        <StatusTimeline
          payment={payment}
          collectorAddress={collectorAddress}
          fundingTxHash={fundingTxHash}
          payoutTxHash={payoutTxHash}
        />
      </div>
    );
  }, [payment, resolvedRecipient, collectorAddress, fundingTxHash, payoutTxHash]);

  return (
    <div className="app-shell">
      <div className="hero">
        <div className="pill">ZuriPay · Private payouts</div>
        <h1>Pay anyone in ETH, settle privately with ZEC + NEAR intents</h1>
        <p>
          Frontend guides the funding transfer, backend burns ZEC, posts NEAR intent, and
          instantly pays out from a solver wallet. No ZEC or NEAR knowledge required.
        </p>
        {walletAddress && (
          <div className="badge">
            Connected wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </div>
        )}
      </div>

      <div className="grid">
        <div className="card">
          <div className="stack">
            <h3 style={{ margin: 0 }}>Send private payment</h3>
            <SendForm onSubmit={handleSubmit} disabled={busy} />
            {amountWithFee && (
              <div className="muted">
                Funding amount with buffer: <strong>{amountWithFee} ETH</strong> to
                collector <code>{collectorAddress}</code>
              </div>
            )}
            {statusMessage && <div className="badge">{statusMessage}</div>}
            {error && <div className="badge">⚠️ {error}</div>}
          </div>
        </div>

        {statusCard}
      </div>
    </div>
  );
}

export default App;
