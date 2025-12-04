import { PaymentStatus, Payment } from "../lib/api";

interface Props {
  payment?: Payment | null;
  collectorAddress?: string;
  fundingTxHash?: string;
  payoutTxHash?: string;
}

const STATUS_ORDER: PaymentStatus[] = [
  "CREATED",
  "WAITING_FOR_FUNDING",
  "FUNDED",
  "INTENT_POSTED",
  "PAID",
  "ERROR",
];

export function StatusTimeline({
  payment,
  collectorAddress,
  fundingTxHash,
  payoutTxHash,
}: Props) {
  const currentStatus = payment?.status ?? "CREATED";
  const currentIndex = STATUS_ORDER.indexOf(currentStatus as PaymentStatus);
  const isSolPay = (payment?.payAsset || "").toUpperCase().includes("SOL");
  const fundingHref = fundingTxHash
    ? isSolPay
      ? `https://orb.helius.dev/tx/${fundingTxHash}?cluster=devnet`
      : `https://sepolia.etherscan.io/tx/${fundingTxHash}`
    : undefined;

  const steps = [
    {
      label: "Request created",
      status: "CREATED",
      meta: undefined,
      full: undefined,
    },
    {
      label: "Awaiting your deposit",
      status: "WAITING_FOR_FUNDING",
      meta: fundingTxHash
        ? `Funding tx: ${shortHash(fundingTxHash)}`
        : "Send ETH to collector",
      full: fundingTxHash,
      href: fundingHref,
    },
    {
      label: "Deposit confirmed",
      status: "FUNDED",
      meta: fundingTxHash ? `Funding tx: ${shortHash(fundingTxHash)}` : undefined,
      full: fundingTxHash,
      href: fundingHref,
    },
    {
      label: "Intent posted on NEAR",
      status: "INTENT_POSTED",
      meta: payment?.nearIntentTxHash
        ? `Intent tx: ${shortHash(payment.nearIntentTxHash)}`
        : undefined,
      full: payment?.nearIntentTxHash,
      href: payment?.nearIntentTxHash
        ? `https://explorer.testnet.near.org/transactions/${payment.nearIntentTxHash}`
        : undefined,
    },
    {
      label: "Payout sent",
      status: "PAID",
      meta: payoutTxHash
        ? `Payout tx: ${shortHash(payoutTxHash)}`
        : undefined,
      full: payoutTxHash,
      href: payoutTxHash
        ? `https://sepolia.etherscan.io/tx/${payoutTxHash}`
        : undefined,
    },
  ];

  return (
    <div className="stack">
      {steps.map((step, idx) => {
        const statusIndex = STATUS_ORDER.indexOf(step.status as PaymentStatus);
        let state: "waiting" | "active" | "done" = "waiting";

        if (statusIndex < currentIndex) {
          state = "done";
        } else if (statusIndex === currentIndex) {
          state = "active";
          // If we've reached PAID, render the last step as done/complete instead of active/warning
          if (currentStatus === "PAID" && step.status === "PAID") {
            state = "done";
          }
        }

        return (
          <div key={step.status} className="status-item">
            <div className={`status-dot ${state}`} />
            <div>
              <div className="status-label">{step.label}</div>
              <div className="status-meta" title={step.full || undefined}>
                {state === "active" && currentStatus === "ERROR"
                  ? "Something went wrong"
                  : step.href && step.meta ? (
                      <a href={step.href} target="_blank" rel="noreferrer">
                        {step.meta}
                      </a>
                    ) : (
                      step.meta || "Pending"
                    )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function shortHash(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}
