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
  "ZEC_BURNED",
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

  const steps = [
    {
      label: "Intent created",
      status: "CREATED",
      meta: collectorAddress
        ? `Collector: ${collectorAddress.slice(0, 10)}...`
        : undefined,
    },
    {
      label: "Awaiting your deposit",
      status: "WAITING_FOR_FUNDING",
      meta: fundingTxHash
        ? `Funding tx: ${shortHash(fundingTxHash)}`
        : "Send ETH to collector",
    },
    {
      label: "Deposit confirmed",
      status: "FUNDED",
      meta: fundingTxHash ? `Funding tx: ${shortHash(fundingTxHash)}` : undefined,
    },
    {
      label: "ZEC privacy burn",
      status: "ZEC_BURNED",
      meta: payment?.zcashBurnTxId
        ? `Burn proof: ${shortHash(payment.zcashBurnTxId)}`
        : undefined,
    },
    {
      label: "Intent posted on NEAR",
      status: "INTENT_POSTED",
      meta: payment?.nearIntentId
        ? `Intent id: ${payment.nearIntentId}`
        : undefined,
    },
    {
      label: "Payout sent",
      status: "PAID",
      meta: payoutTxHash
        ? `Payout tx: ${shortHash(payoutTxHash)}`
        : undefined,
    },
  ];

  return (
    <div className="stack">
      {steps.map((step, idx) => {
        const statusIndex = STATUS_ORDER.indexOf(step.status as PaymentStatus);
        let state: "waiting" | "active" | "done" = "waiting";

        if (statusIndex < currentIndex) state = "done";
        else if (statusIndex === currentIndex) state = "active";

        return (
          <div key={step.status} className="status-item">
            <div className={`status-dot ${state}`} />
            <div>
              <div className="status-label">{step.label}</div>
              <div className="status-meta">
                {state === "active" && currentStatus === "ERROR"
                  ? "Something went wrong"
                  : step.meta || "Pending"}
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
