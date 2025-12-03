import dotenv from "dotenv";
import { app } from "./api/server";
import { initEthClient } from "./lib/eth";
import { initNearClient } from "./lib/nearClient";
import { startWorker } from "./worker";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;
const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR_KEY";
const COLLECTOR_ADDRESS = process.env.COLLECTOR_ADDRESS!;
const SOLVER_PRIVATE_KEY = process.env.SOLVER_PRIVATE_KEY;
const NEAR_CONTRACT_ID =
  process.env.NEAR_CONTRACT_ID || "zuripay.testnet";
const NEAR_ACCOUNT_ID = process.env.NEAR_ACCOUNT_ID || "zuripay.testnet";

async function main() {
  console.log("🚀 Starting ZuriPay backend...");

  // Validate required environment variables
  if (!COLLECTOR_ADDRESS) {
    console.error("❌ COLLECTOR_ADDRESS environment variable is required");
    process.exit(1);
  }

  // Initialize clients
  console.log("Initializing Ethereum client...");
  initEthClient(SEPOLIA_RPC_URL, COLLECTOR_ADDRESS, SOLVER_PRIVATE_KEY);
  console.log(`✓ Collector address: ${COLLECTOR_ADDRESS}`);
  if (SOLVER_PRIVATE_KEY) {
    console.log("✓ Solver wallet configured");
  } else {
    console.warn("⚠️  SOLVER_PRIVATE_KEY not set; payouts will be unavailable");
  }

  console.log("Initializing NEAR client...");
  initNearClient(NEAR_CONTRACT_ID, NEAR_ACCOUNT_ID);
  console.log(`✓ NEAR contract: ${NEAR_CONTRACT_ID}`);

  // Start worker for payment processing
  console.log("Starting payment processor worker...");
  startWorker(10000); // Process every 10 seconds
  console.log("✓ Worker started");

  // Start API server
  app.listen(PORT, () => {
    console.log(`✓ API server listening on port ${PORT}`);
    console.log(`\n🎉 ZuriPay backend is ready!`);
    console.log(`   API: http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health\n`);
  });
}

main().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});
