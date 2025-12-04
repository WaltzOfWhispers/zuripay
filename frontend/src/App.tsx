import { useEffect, useMemo, useState } from "react";
import { EthereumProvider } from "@walletconnect/ethereum-provider";
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
  const isHowItWorks = typeof window !== "undefined" &&
    window.location.pathname.includes("how-it-works");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [collectorAddress, setCollectorAddress] = useState<string>();
  const [amountWithFee, setAmountWithFee] = useState<string>();
  const [fundingTxHash, setFundingTxHash] = useState<string>();
  const [payoutTxHash, setPayoutTxHash] = useState<string>();
  const [resolvedRecipient, setResolvedRecipient] = useState<string>();
  const [walletAddress, setWalletAddress] = useState<string>();
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wcProvider, setWcProvider] = useState<any | null>(null);

  // Render dedicated How It Works page
  if (isHowItWorks) {
    return (
      <div className="app-shell">
        <div className="hero">
        <div className="pill">Zuri · Private Swap</div>
        <h1>How it works</h1>
        <p>End-to-end private routing without exposing the rails.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a className="button" href="/">
            Back to app
          </a>
        </div>
        </div>
        <div className="card">
          <div className="stack">
            <div className="muted">1) You fund a collector address from your wallet.</div>
            <div className="muted">
              2) The backend posts an intent, applies the privacy layer, and routes solver payout.
            </div>
            <div className="muted">
              3) Funds arrive privately at the destination; you track status in the app.
            </div>
          </div>
        </div>
      </div>
    );
  }

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

    try {
      const resolved = await resolveRecipient(recipient, wcProvider ?? undefined);
      setResolvedRecipient(resolved);

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

      const txHash = await sendEth({
        to: intent.collectorAddress,
        amountEth: intent.amountEthWithFee,
        externalProvider: wcProvider ?? undefined,
      });

      setFundingTxHash(txHash);

      await attachFundingTx({
        paymentId: intent.paymentId,
        fundingTxHash: txHash,
      });

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

  const handleConnectWallet = async () => {
    try {
      const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
      if (!projectId) {
        setError("WalletConnect project ID missing");
        return;
      }
      const provider = await EthereumProvider.init({
        projectId,
        showQrModal: true,
        chains: [11155111], // Sepolia
        optionalChains: [],
        rpcMap: {
          11155111: "https://rpc.sepolia.org",
        },
        methods: ["eth_sendTransaction", "eth_accounts", "eth_requestAccounts"],
        events: ["chainChanged", "accountsChanged"],
      });

      provider.on("accountsChanged", (accounts: string[]) => {
        if (accounts?.length) {
          setWalletAddress(accounts[0]);
        }
      });

      const session = await provider.connect();
      const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
      setWalletAddress(accounts[0]);
      setWcProvider(provider);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error && err.message ? err.message : "Wallet connection failed"
      );
    }
  };

  const handleDisconnect = async () => {
    try {
      if (wcProvider) {
        await wcProvider.disconnect();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWalletAddress(undefined);
      setWcProvider(null);
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
        <img src="/zuri-logo.svg" alt="Zuri logo" style={{ width: 64, height: 64 }} />
        <h1 style={{ marginTop: 8 }}>Zuri</h1>
        <p>Move value cross-chain without revealing the path.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            className="button"
            onClick={() =>
              document.getElementById("swap-card")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Send privately
          </button>
          {walletAddress ? (
            <button className="button" type="button" onClick={handleDisconnect}>
              Disconnect {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </button>
          ) : (
            <button className="button" type="button" onClick={handleConnectWallet}>
              Connect wallet
            </button>
          )}
          <a className="badge" href="/how-it-works">
            How it works
          </a>
        </div>
      </div>

      <div className="grid">
        <div className="card" id="swap-card">
          <div className="stack">
            <h3 style={{ margin: 0 }}>Send privately</h3>
            <SendForm onSubmit={handleSubmit} disabled={busy} />
            {amountWithFee && (
              <div className="muted">
                Funding amount with buffer: <strong>{amountWithFee} ETH</strong> to
                collector <code>{collectorAddress}</code>
              </div>
            )}
            {error && <div className="badge">⚠️ {error}</div>}
          </div>
        </div>

        {statusCard}
      </div>
    </div>
  );
}

export default App;
