# Zuri — Private, Cross‑Chain Settlement (Zypherpunk Hackathon)

Zuri: Private cross-chain payouts powered by Zcash — fund from any chain, pay to any chain, stay unlinked.

Zuri is a lightweight cross-chain settlement layer that lets users fund a payment on any chain and deliver it privately to Solana or another chain like ETH,  without revealing the sender or linking the source to the destination. Users never hold or see ZEC. Instead, Zuri maintains its own shielded Zcash balance, periodically funding in the backend to preserve a strong anonymity set while providing a simple, familiar “Send Privately” UX.

Zuri demonstrates how Zcash can serve as the core privacy rail of a multichain world, solving a foundational problem in crypto: private cross-chain value transfer that feels as simple as sending a normal transaction.

## How Zuri Works

User funds with any asset (e.g., SOL or ETH or USDC).

Zuri receives the user funding on the originating chain while paying out to the destination chain via ZEC shielded transfers.

A NEAR intent encodes the payout request in a verifiable, chain-agnostic format.

Zuri’s solver executes a private payout on the destination chain (e.g., USDC on Solana Devnet) with no visible connection to the original funder.

To the user, this all appears as a single action:

“Send Privately” — from any chain to any chain.

## Why Zuri Matters

Bridges and cross-chain routers expose sender→recipient linkages. Zuri instead uses Zcash’s shielded pool as a periodically replenished privacy substrate, enabling unlinkable private payouts to Solana without requiring users to touch ZEC or manage extra wallets.

This unlocks:

- Private Solana-bound remittances

- ZEC-backed privacy for any-chain → Solana transfers

- Clean infrastructure for apps needing private cross-chain settlement

Zuri shows how Zcash can serve as an invisible, renewable privacy backbone for Solana-focused applications.

## Architecture
- **Frontend**: React/Vite/TS, WalletConnect (EVM), Phantom (Solana). Single-page form + timeline.
- **Backend**: Node/TS, Express REST, in-memory payments, ETH & SOL funding verification, NEAR intent poster, solver loop (mock payouts by default).
- **NEAR contract**: Rust, stores intents, mark_fulfilled.
- **Privacy layer**: Zcash stub (interface ready; replace with light client later).

## Run It (local)
```bash
git clone <repo>
cd zuri
```
Backend
```bash
cd backend
npm install
cp .env.example .env   # fill values below
npm run dev
```
Frontend
```bash
cd frontend
npm install
cp .env.example .env   # set WC project ID + Solana vars
npm run dev
```
NEAR contract
```bash
cd near-contract
cargo near build   # deploy to NEAR testnet and set NEAR_CONTRACT_ID in backend env
```

## Required Env (fast path)
Backend `.env`:
- `SEPOLIA_RPC_URL`, `COLLECTOR_ADDRESS`
- `NEAR_CONTRACT_ID`, `NEAR_ACCOUNT_ID`, `NEAR_PRIVATE_KEY`, `NEAR_NODE_URL`
- `SOL_RPC_URL=https://api.devnet.solana.com`
- `SOL_COLLECTOR_ADDRESS=<devnet collector>`
- Optional: `MOCK_SOLVER_TX=true` to mock payouts

Frontend `.env`:
- `VITE_WALLETCONNECT_PROJECT_ID=<your_wc_project_id>`
- `VITE_SOL_COLLECTOR_ADDRESS=<same as backend>`
- `VITE_SOL_RPC_URL=https://api.devnet.solana.com`

## API (for scripts/cli)
- `POST /api/create-payment-intent` `{ recipient, destAsset, destAmount, payAsset }`
- `POST /api/attach-funding-tx` `{ paymentId, fundingTxHash }`
- `GET /api/payment-status?paymentId=...`
- `GET /api/payments` (debug)

## Shipped vs Stubbed
- ✅ ETH & SOL funding, verification, NEAR intents, explorer links, mock solver.
- ⏳ USDC pay-in, real Zcash shielded transfers, production solver payouts (interfaces ready).

## Troubleshooting
- Stuck at CREATED: funding tx hash not attached (send failed or attach didn’t fire); attach manually via API.
- Stuck at WAITING_FOR_FUNDING: verification failed (wrong network/collector/amount); confirm RPC/envs and tx details.
- Phantom issues: ensure Devnet + valid collector address; non-zero amount.
- Build errors: run `npm install` in backend/frontend; Node required.

## One-liner
“Zuri is the private cross-chain router: fund on ETH or SOL, deliver privately anywhere, with intents on NEAR and a drop-in Zcash privacy layer—demo-ready in minutes, production-ready with oracles/solvers.”
