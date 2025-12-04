export type PaymentStatus =
  | "CREATED"
  | "WAITING_FOR_FUNDING"
  | "FUNDED"
  | "ZEC_COLLECTED"
  | "INTENT_POSTED"
  | "PAID"
  | "ERROR";

export interface Payment {
  id: string;
  recipient: string;
  // Deposit side (always ETH for now)
  amountEth: string;
  payAsset?: string;
  payAmountFunding?: string;
  payAmountWithFee?: string;
  payFee?: string;
  // Destination asset details
  destAsset?: string; // e.g., ETH, USDC, SOL, USDC_SOL
  destAmount?: string; // human-readable amount in destination asset
  destDecimals?: number; // decimals for destination asset
  destChain?: string; // e.g., ethereum-sepolia, solana
  collectorAddress: string;
  fundingTxHash?: string;
  zcashBurnTxId?: string;
  nearIntentId?: string;
  nearIntentTxHash?: string;
  payoutTxHash?: string;
  status: PaymentStatus;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

class PaymentStore {
  private payments: Map<string, Payment> = new Map();

  create(payment: Payment): void {
    this.payments.set(payment.id, payment);
  }

  get(id: string): Payment | undefined {
    return this.payments.get(id);
  }

  update(id: string, updates: Partial<Payment>): Payment | undefined {
    const payment = this.payments.get(id);
    if (!payment) return undefined;

    const updated = {
      ...payment,
      ...updates,
      updatedAt: Date.now(),
    };
    this.payments.set(id, updated);
    return updated;
  }

  getByStatus(status: PaymentStatus): Payment[] {
    return Array.from(this.payments.values()).filter((p) => p.status === status);
  }

  getAll(): Payment[] {
    return Array.from(this.payments.values());
  }
}

export const paymentStore = new PaymentStore();
