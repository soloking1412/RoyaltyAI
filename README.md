# RoyaltyAI (Bags Hackathon Prototype)

Prototype that uses the Bags API to make creator royalties actionable via “AI-style” insights and payload builders (payload-only; no private keys are exposed).

## What’s included

1. Token feed discovery
   - Load active token launches from `GET /token-launch/feed`
2. Royalty/claim analytics dashboard
   - Insights for a `tokenMint` using:
     - `GET /token-launch/claim-stats`
     - `GET /token-launch/lifetime-fees`
     - `GET /fee-share/token/claim-events` (time mode)
   - Shows:
     - top claimers leaderboard
     - claim velocity (last N days)
     - recommendations (claim vs buyback quote guidance)
3. AI buyback planner (quote only)
   - `POST /api/ai/plan-buyback`
   - Safety rule: quotes are only generated when `inputMint` is wSOL (lamport-compatible).
   - Natural language parsing:
     - percentage from strings like `20%` or `20 percent`
     - time window from strings like `this week`, `last 30d`, `past 7 days`
4. Transaction payload builders
   - `POST /api/token/claim-txs/v3` (single fee claimer)
   - `POST /api/token/claim-txs/v3/bulk` (bulk fee claimers)
   - `POST /api/trade/swap-tx` (creates swap transaction bytes from a pasted `quoteResponse`)
5. Optional “Bags Agent Auth” panel (still payload-only)
   - Uses Bags agent auth flow:
     - `POST /agent/auth/init`
     - `POST /agent/auth/login`
     - `POST /agent/wallet/list`
   - Lets you load agent-owned wallets and feed selected wallets into bulk `claim-txs/v3` generation.

## Setup

1. Create an API key in `dev.bags.fm`
2. Copy env file:
   - `.env.example` -> `.env`
3. Set:
   - `BAGS_API_KEY=...`

Optional env:
- `PORT` (default `3000`)
- `CLAIM_INACTIVITY_DAYS` (default `14`)
- `RECENT_PERIOD_DAYS` (default `30`)
- `CACHE_TTL_MS` (default `30000`)

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`

## Production Start

```bash
npm run build
npm start
```

## Notes / Safety

This prototype does **not**:
- execute swaps automatically
- submit claim transactions automatically

All payload builders return serialized transaction data that still needs to be signed/submitted by a wallet/agent on your side.

