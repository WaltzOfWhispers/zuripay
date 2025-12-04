import { useEffect, useMemo, useRef, useState } from "react";
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
import { isSolAddress } from "./lib/sol";
import { sendSol, sendUsdcSol } from "./lib/solanaSend";

function App() {
  const isHowItWorks = typeof window !== "undefined" &&
    window.location.pathname.includes("how-it-works");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [collectorAddress, setCollectorAddress] = useState<string>();
  const [amountWithFee, setAmountWithFee] = useState<string>();
  const [amountFunding, setAmountFunding] = useState<string>();
  const [feeEth, setFeeEth] = useState<string>();
  const [payAmountWithFee, setPayAmountWithFee] = useState<string>();
  const [payAmountFunding, setPayAmountFunding] = useState<string>();
  const [payFee, setPayFee] = useState<string>();
  const [fundingTxHash, setFundingTxHash] = useState<string>();
  const [payoutTxHash, setPayoutTxHash] = useState<string>();
  const [resolvedRecipient, setResolvedRecipient] = useState<string>();
  const [walletAddress, setWalletAddress] = useState<string>();
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wcProvider, setWcProvider] = useState<any | null>(null);
  const [chainId, setChainId] = useState<string | undefined>();
  const [solWallet, setSolWallet] = useState<string | undefined>();
  const [showConnectOptions, setShowConnectOptions] = useState(false);
  const connectMenuRef = useRef<HTMLDivElement | null>(null);

  // Render dedicated How It Works page
  if (isHowItWorks) {
    return (
      <div className="app-shell">
        <div className="hero">
          <img src="/zuri-logo.svg" alt="Zuri logo" style={{ width: 64, height: 64 }} />
          <h1 style={{ marginTop: 8 }}>How Zuri works</h1>
          <p>Private, cross-chain settlement without exposing the rails.</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a className="button" href="/">
              Back to app
            </a>
            <a className="badge" href="#flow">View flow</a>
          </div>
        </div>
        <div className="grid" id="flow">
          <div className="card">
            <div className="pill">Flow</div>
            <h3 style={{ marginTop: 8 }}>Three simple steps</h3>
            <div className="stack" style={{ gap: 10 }}>
              <div className="muted">1) You submit recipient + amount, then fund a single-use address.</div>
              <div className="muted">2) Zuri posts an intent, handles the privacy layer, and coordinates solver payout.</div>
              <div className="muted">3) The destination receives value privately; you track it in the timeline.</div>
            </div>
          </div>
          <div className="card">
            <div className="pill">What you won’t see</div>
            <h3 style={{ marginTop: 8 }}>No rails, no hops</h3>
            <div className="stack" style={{ gap: 10 }}>
              <div className="muted">No ZEC, NEAR, or routing details surfaced to the user.</div>
              <div className="muted">Solvers fund the payout; your wallet only signs the initial send.</div>
              <div className="muted">Everything else is automated behind the scenes.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No auto-connect on load to avoid prompting wallets like Phantom; user triggers connect explicitly.

  // Track injected chain for MetaMask/extension users to prompt Sepolia
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;

    eth
      .request({ method: "eth_chainId" })
      .then((cid: string) => setChainId(cid))
      .catch(() => {});

    const onChainChanged = (cid: string) => setChainId(cid);
    eth.on?.("chainChanged", onChainChanged);
    return () => eth.removeListener?.("chainChanged", onChainChanged);
  }, []);

  // Track WalletConnect chain as well (mobile)
  useEffect(() => {
    if (!wcProvider) return;
    wcProvider
      .request({ method: "eth_chainId" })
      .then((cid: string) => setChainId(cid))
      .catch(() => {});

    const onChainChanged = (cid: string) => setChainId(cid);
    wcProvider.on?.("chainChanged", onChainChanged);
    return () => wcProvider.removeListener?.("chainChanged", onChainChanged);
  }, [wcProvider]);

  // Close connect menu on outside click
  useEffect(() => {
    if (!showConnectOptions) return;
    const onClick = (e: MouseEvent) => {
      if (connectMenuRef.current && !connectMenuRef.current.contains(e.target as Node)) {
        setShowConnectOptions(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [showConnectOptions]);

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

  const handleSubmit = async ({ recipient, amount, asset, payAsset }: SendFormValues) => {
    setError(null);

    if (!walletAddress && !wcProvider && !solWallet) {
      setError("Connect a wallet before sending.");
      return;
    }

    setBusy(true);

    try {
      if (payAsset !== "ETH") {
        // For SOL/USDC_SOL pay-in, skip ENS resolution and auto-send
        // ENS resolution still applies for EVM addresses
      }

      const needsSolAddress = asset === "SOL" || asset === "USDC_SOL";
      if (needsSolAddress && !isSolAddress(recipient)) {
        setError("Please enter a valid Solana address.");
        return;
      }

      const resolved =
        asset === "SOL" || asset === "USDC_SOL"
          ? recipient
          : await resolveRecipient(recipient, wcProvider ?? undefined);
      setResolvedRecipient(resolved);

      const intent = await createPaymentIntent({
        recipient: resolved,
        destAsset: asset,
        destAmount: amount,
        payAsset,
      });

      setCollectorAddress(intent.collectorAddress);
      setAmountWithFee(intent.amountEthWithFee);
      setAmountFunding(intent.amountEthFunding ?? intent.amountEthWithFee);
      setFeeEth(intent.feeEth ?? "0");
      setPayAmountWithFee(intent.payAmountWithFee ?? intent.amountEthWithFee);
      setPayAmountFunding(intent.payAmountFunding ?? intent.amountEthFunding ?? intent.amountEthWithFee);
      setPayFee(intent.payFee ?? intent.feeEth ?? "0");

      const newPayment: Payment = {
        id: intent.paymentId,
        recipient: resolved,
        amountEth: intent.amountEthWithFee,
        destAsset: asset,
        destAmount: amount,
        payAsset,
        collectorAddress: intent.collectorAddress,
        status: "CREATED",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setPayment(newPayment);

      // Always send the backend-quoted pay amount (with fee)
      const payAmountToSend =
        payAsset === "ETH"
          ? intent.amountEthWithFee
          : intent.payAmountWithFee || payAmountWithFee || "0";

      let txHash: string;
      if (payAsset === "ETH") {
        txHash = await sendEth({
          to: intent.collectorAddress,
          amountEth: payAmountToSend,
          externalProvider: wcProvider ?? undefined,
        });
      } else if (payAsset === "SOL") {
        const solCollector = import.meta.env.VITE_SOL_COLLECTOR_ADDRESS?.trim();
        if (!solCollector) {
          setError("SOL collector address not set.");
          return;
        }
        if (!isSolAddress(solCollector)) {
          setError("Configured SOL collector address is invalid.");
          return;
        }
        const solRpc =
          import.meta.env.VITE_SOL_RPC_URL || "https://api.devnet.solana.com";

        if (!payAmountToSend || parseFloat(payAmountToSend) <= 0) {
          setError("Calculated SOL amount is invalid.");
          return;
        }

        txHash = await sendSol({
          to: solCollector,
          amountSol: payAmountToSend,
          rpcUrl: solRpc,
        });
      } else {
        setError("USDC funding will be supported in a future release. Please use SOL or ETH for now.");
        return;
      }

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
      setError(null);
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
      const cid = (await provider.request({ method: "eth_chainId" })) as string;
      setChainId(cid);
      setWalletAddress(accounts[0]);
      setWcProvider(provider);
      setShowConnectOptions(false);
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
      setSolWallet(undefined);
    }
  };

  const handleConnectPhantom = async () => {
    try {
      const provider = (window as any).solana;
      if (!provider || (!provider.isPhantom && !provider.isBackpack && !provider.isSolflare)) {
        setError("No Solana wallet detected. Open Phantom/Backpack/Solflare.");
        return;
      }
      const resp = await provider.connect();
      const pubkey = resp?.publicKey?.toString();
      if (!pubkey) {
        setError("Unable to read Solana public key.");
        return;
      }
      setSolWallet(pubkey);
      setError(null);
      setShowConnectOptions(false);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Solana wallet connection failed");
    }
  };

  const statusCard = useMemo(() => {
    if (!payment) return null;
    return (
      <div className="card status-card">
        <div className="pill">Payment status</div>
        <h3 style={{ marginBottom: 8, marginTop: 12 }}>
          {payment.destAmount ?? payment.amountEth} {payment.destAsset ?? "ETH"} →{" "}
          {resolvedRecipient ?? payment.recipient}
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

  const handleSwitchToSepolia = async () => {
    const provider = wcProvider ?? (window as any).ethereum;
    if (!provider) {
      setError("No wallet connected. Use WalletConnect or install MetaMask.");
      return;
    }
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }], // Sepolia
      });
    } catch (err: any) {
      // If chain is missing, prompt to add it
      if (err?.code === 4902) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0xaa36a7",
                chainName: "Sepolia",
                nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://rpc.sepolia.org"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
        } catch (addErr) {
          setError(
            addErr instanceof Error ? addErr.message : "Failed to add Sepolia network"
          );
        }
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to switch to Sepolia network"
        );
      }
    }
  };

  const isSepolia =
    chainId === "0xaa36a7" ||
    chainId === "11155111" ||
    chainId === "sepolia" ||
    chainId === 11155111;

  return (
    <div className="app-shell">
        <div className="hero">
          <img src="/zuri-logo.svg" alt="Zuri logo" style={{ width: 64, height: 64 }} />
          <h1 style={{ marginTop: 8 }}>Zuri</h1>
          <p>Send Privately. From Anywhere. To Anywhere.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }} ref={connectMenuRef}>
            {walletAddress || solWallet ? (
              <button className="button" type="button" onClick={handleDisconnect}>
                Disconnect{" "}
                {(walletAddress || solWallet || "").slice(0, 6)}...
                {(walletAddress || solWallet || "").slice(-4)}
              </button>
            ) : (
              <>
                <button
                  className="button"
                  type="button"
                  onClick={() => setShowConnectOptions((v) => !v)}
                >
                  Connect wallet
                </button>
                {showConnectOptions && (
                  <div
                    style={{
                      position: "absolute",
                      top: "110%",
                      left: 0,
                      background: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
                      padding: 10,
                      zIndex: 10,
                      minWidth: 200,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <button className="button" type="button" onClick={handleConnectPhantom}>
                      Phantom
                    </button>
                    <button className="button" type="button" onClick={handleConnectWallet}>
                      WalletConnect
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          <a className="badge" href="/how-it-works">
            How it works
          </a>
        </div>
        {walletAddress && !isSepolia && (
          <div className="badge" style={{ marginTop: 12 }}>
            Connected wallet is not on Sepolia. Please switch to Sepolia testnet.
            <button
              className="button"
              type="button"
              style={{ marginLeft: 8 }}
              onClick={handleSwitchToSepolia}
            >
              Switch to Sepolia
            </button>
          </div>
        )}
      </div>

      <div className="grid">
        <div className="card" id="swap-card">
          <div className="stack">
            <h3 style={{ margin: 0 }}>Send privately</h3>
            <SendForm onSubmit={handleSubmit} disabled={busy} />
            {amountWithFee && (
              <div className="muted stack" style={{ gap: 4 }}>
                <div>
                  Send{" "}
                  <strong>
                    {payAmountWithFee || amountWithFee} {payment?.payAsset || "ETH"}
                  </strong>{" "}
                  to deliver{" "}
                  <strong>
                    {payment?.destAmount ?? payment?.amountEth} {payment?.destAsset ?? "ETH"}
                  </strong>
                </div>
                {payAmountFunding && payFee ? (
                  <div>
                    ({payAmountFunding} {payment?.payAsset || "ETH"} base + fee {payFee}{" "}
                    {payment?.payAsset || "ETH"})
                  </div>
                ) : null}
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Shielding fee: 0.1% applied to the pay amount.
                </div>
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
