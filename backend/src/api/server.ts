import express, { Request, Response } from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { Payment, PaymentStatus, paymentStore } from "../models/payment";
import { getCollectorAddress } from "../lib/eth";

const app = express();

app.use(cors());
app.use(express.json());

function normalizeStatus(status: PaymentStatus): PaymentStatus {
  return status === "ZEC_BURNED" ? "ZEC_COLLECTED" : status;
}

/**
 * POST /api/create-payment-intent
 * Create a new payment intent
 */
app.post("/api/create-payment-intent", async (req: Request, res: Response) => {
  try {
    const { recipient, destAsset = "ETH", destAmount, destChain: destChainInput, payAsset } = req.body;

    if (!recipient || !destAmount) {
      return res.status(400).json({
        error: "Missing required fields: recipient, destAmount",
      });
    }

    // Validate amount
    const amount = parseFloat(destAmount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        error: "Invalid amount",
      });
    }

    // Map asset to decimals and rough ETH conversion (placeholder; replace with real pricing)
    const assetRaw = String(destAsset || "ETH").toUpperCase();
    const isUsdcSol = assetRaw === "USDC_SOL" || assetRaw === "USDC-SOL";
    const asset = isUsdcSol ? "USDC" : assetRaw;
    const destDecimals = asset === "USDC" ? 6 : asset === "SOL" ? 9 : 18;
    let destChain = destChainInput as string | undefined;
    if (!destChain) {
      destChain = asset === "SOL" || isUsdcSol ? "solana" : "ethereum-sepolia";
    }
    // Static price map (USD) for conversion between assets
    // In production replace with a price oracle.
    const priceUsd = (symbol: string) => {
      switch (symbol) {
        case "USDC":
          return 1; // 1 USDC = $1
        case "SOL":
          return 20; // stub: 1 SOL = $20
        default:
          return 3000; // ETH price stub: $3000
      }
    };

    const paySymbolRaw = String(payAsset || "ETH").toUpperCase();
    const payIsUsdcSol = paySymbolRaw === "USDC_SOL" || paySymbolRaw === "USDC-SOL";
    const paySymbol = payIsUsdcSol ? "USDC" : paySymbolRaw;

    const destUsd = priceUsd(asset);
    const payUsd = priceUsd(paySymbol);

    // Convert destination value to pay asset using USD as bridge
    const payAmountFunding = (amount * destUsd) / payUsd;
    const payAmountWithFee = payAmountFunding * 1.001;
    const payFee = payAmountWithFee - payAmountFunding;

    // Keep ETH funding fields for compatibility (still ETH-only funding flow)
    const amountEthValue = (payAmountFunding * payUsd) / priceUsd("ETH");
    const amountEth = amountEthValue.toString();

    // Create payment record
    const paymentId = randomUUID();
    const collectorAddress = getCollectorAddress();

    // Add small fee buffer (0.1%) on the ETH funding side
    const amountWithFee = (amountEthValue * 1.001).toFixed(6);
    const feeEth = (parseFloat(amountWithFee) - amountEthValue).toFixed(6);

    console.log("[QUOTE] dest", {
      paymentId,
      recipient,
      destAsset: asset,
      destAmount,
      destUsd,
      payAsset: paySymbol,
      payUsd,
      payAmountFunding: payAmountFunding.toFixed(6),
      payAmountWithFee: payAmountWithFee.toFixed(6),
    });

    const payment: Payment = {
      id: paymentId,
      recipient,
      amountEth,
      payAsset: payAsset || "ETH",
      payAmountFunding: payAmountFunding.toFixed(6),
      payAmountWithFee: payAmountWithFee.toFixed(6),
      payFee: payFee.toFixed(6),
      destAsset: asset,
      destAmount: destAmount.toString(),
      destDecimals,
        destChain,
      collectorAddress,
      status: "CREATED",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    paymentStore.create(payment);

    res.json({
      paymentId,
      collectorAddress,
      amountEthWithFee: amountWithFee,
      amountEthFunding: amountEthValue.toFixed(6),
      feeEth,
      payAsset: payAsset || "ETH",
      payAmountWithFee: payAmountWithFee.toFixed(6),
      payAmountFunding: payAmountFunding.toFixed(6),
      payFee: payFee.toFixed(6),
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/attach-funding-tx
 * Attach funding transaction hash to payment
 */
app.post("/api/attach-funding-tx", async (req: Request, res: Response) => {
  try {
    const { paymentId, fundingTxHash } = req.body;

    if (!paymentId || !fundingTxHash) {
      return res.status(400).json({
        error: "Missing required fields: paymentId, fundingTxHash",
      });
    }

    const payment = paymentStore.get(paymentId);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    console.log(`[API] attach-funding-tx payment=${paymentId} tx=${fundingTxHash}`);

    paymentStore.update(paymentId, {
      fundingTxHash,
      status: "WAITING_FOR_FUNDING",
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("Error attaching funding tx:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/payment-status
 * Get payment status
 */
app.get("/api/payment-status", async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.query;

    if (!paymentId || typeof paymentId !== "string") {
      return res.status(400).json({ error: "Missing paymentId" });
    }

    const payment = paymentStore.get(paymentId);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    res.json({
      ...payment,
      status: normalizeStatus(payment.status),
    });
  } catch (error) {
    console.error("Error getting payment status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/payments
 * Get all payments (for debugging)
 */
app.get("/api/payments", async (req: Request, res: Response) => {
  try {
    const payments = paymentStore.getAll();
    res.json(
      payments.map((p) => ({
        ...p,
        status: normalizeStatus(p.status),
      }))
    );
  } catch (error) {
    console.error("Error getting payments:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

export { app };
