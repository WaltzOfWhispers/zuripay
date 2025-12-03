const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

export type PaymentStatus =
  | "CREATED"
  | "WAITING_FOR_FUNDING"
  | "FUNDED"
  | "ZEC_BURNED"
  | "INTENT_POSTED"
  | "PAID"
  | "ERROR";

export interface Payment {
  id: string;
  recipient: string;
  amountEth: string;
  collectorAddress: string;
  fundingTxHash?: string;
  zcashBurnTxId?: string;
  nearIntentId?: string;
  payoutTxHash?: string;
  status: PaymentStatus;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreatePaymentResponse {
  paymentId: string;
  collectorAddress: string;
  amountEthWithFee: string;
}

export async function createPaymentIntent(params: {
  recipient: string;
  amountEth: string;
}): Promise<CreatePaymentResponse> {
  const res = await fetch(`${API_BASE}/create-payment-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new Error(`Create intent failed: ${res.statusText}`);
  }

  return res.json();
}

export async function attachFundingTx(params: {
  paymentId: string;
  fundingTxHash: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/attach-funding-tx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.error || res.statusText;
    throw new Error(`Attach funding failed: ${msg}`);
  }
}

export async function fetchPaymentStatus(paymentId: string): Promise<Payment> {
  const res = await fetch(
    `${API_BASE}/payment-status?paymentId=${encodeURIComponent(paymentId)}`
  );
  if (!res.ok) {
    throw new Error(`Status fetch failed: ${res.statusText}`);
  }
  return res.json();
}
