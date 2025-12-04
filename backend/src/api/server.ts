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
    const { recipient, amountEth } = req.body;

    if (!recipient || !amountEth) {
      return res.status(400).json({
        error: "Missing required fields: recipient, amountEth",
      });
    }

    // Validate amount
    const amount = parseFloat(amountEth);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        error: "Invalid amount",
      });
    }

    // Create payment record
    const paymentId = randomUUID();
    const collectorAddress = getCollectorAddress();

    // Add small fee buffer (0.1%)
    const amountWithFee = (amount * 1.001).toFixed(6);

    const payment: Payment = {
      id: paymentId,
      recipient,
      amountEth,
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
