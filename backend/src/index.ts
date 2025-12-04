import dotenv from "dotenv";
import path from "path";
// Load environment variables before other imports (explicit backend .env path)
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import { app } from "./api/server";
import { initEthClient } from "./lib/eth";
import { initNearClient } from "./lib/nearClient";
import { startWorker } from "./worker";
import { startSolver } from "./solver";
import { registerHttpLightClient } from "./lib/zcashLightClient";

const PORT = process.env.PORT || 3001;
const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR_KEY";
const COLLECTOR_ADDRESS = process.env.COLLECTOR_ADDRESS!;
const NEAR_CONTRACT_ID =
  process.env.NEAR_CONTRACT_ID || "zuripay.testnet";
const NEAR_ACCOUNT_ID = process.env.NEAR_ACCOUNT_ID || "zuripay.testnet";
const NEAR_PRIVATE_KEY = process.env.NEAR_PRIVATE_KEY;
const NEAR_NODE_URL =
  process.env.NEAR_NODE_URL || "https://rpc.testnet.near.org";
const ZCASH_LIGHT_CLIENT_URL = process.env.ZCASH_LIGHT_CLIENT_URL;
const ZCASH_LIGHT_CLIENT_API_KEY = process.env.ZCASH_LIGHT_CLIENT_API_KEY;

async function main() {
  console.log("🚀 Starting Zuri backend...");

  // Validate required environment variables
  if (!COLLECTOR_ADDRESS) {
    console.error("❌ COLLECTOR_ADDRESS environment variable is required");
    process.exit(1);
  }

  // Initialize clients
  console.log("Initializing Ethereum client...");
  try {
    initEthClient(SEPOLIA_RPC_URL, COLLECTOR_ADDRESS);
    console.log(`✓ Collector address: ${COLLECTOR_ADDRESS}`);
  } catch (error) {
    console.error("❌ Failed to initialize Ethereum client:", error instanceof Error ? error.message : error);
    process.exit(1);
  }

  console.log("Initializing NEAR client...");
  await initNearClient(NEAR_CONTRACT_ID, NEAR_ACCOUNT_ID, NEAR_PRIVATE_KEY, NEAR_NODE_URL);
  console.log(`✓ NEAR contract: ${NEAR_CONTRACT_ID}`);

  // Start worker for payment processing
  console.log("Starting payment processor worker...");
  startWorker(10000); // Process every 10 seconds
  console.log("✓ Worker started");

  // Register external Zcash light client wrapper if configured
  if (ZCASH_LIGHT_CLIENT_URL) {
    registerHttpLightClient(
      ZCASH_LIGHT_CLIENT_URL,
      ZCASH_LIGHT_CLIENT_API_KEY
    );
  } else {
    console.warn(
      "⚠️  ZCASH_LIGHT_CLIENT_URL not set; Zcash burns/payouts will remain stubbed"
    );
  }

  // Start solver loop to fulfill intents with shielded ZEC
  console.log("Starting solver...");
  startSolver(10000);
  console.log("✓ Solver started");

  // Start API server
  app.listen(PORT, () => {
    console.log(`✓ API server listening on port ${PORT}`);
    console.log(`\n🎉 Zuri backend is ready!`);
    console.log(`   API: http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health\n`);
  });
}

main().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});
