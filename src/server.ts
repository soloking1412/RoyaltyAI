import "dotenv/config";

import express from "express";
import { z } from "zod";

import {
  createSwapTransaction,
  getClaimTransactionsV3,
  agentAuthInit,
  agentAuthLogin,
  agentWalletList,
  getTokenClaimEvents,
  getTokenClaimStats,
  getTokenLifetimeFees,
  getTokenLaunchFeed,
  getTradeQuote,
} from "./bagsClient.js";

import { buildInsights, parsePercentFromText, parseTimeWindowDaysFromText, toBigIntSafe, formatLamportsSol } from "./insights.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT ?? 3000);
const CLAIM_INACTIVITY_DAYS = Number(process.env.CLAIM_INACTIVITY_DAYS ?? 14);
const RECENT_PERIOD_DAYS = Number(process.env.RECENT_PERIOD_DAYS ?? 30);

// Wrapped SOL mint (commonly where Bags fees land for creator claiming flows).
const WSOL_MINT = "So11111111111111111111111111111111111111112";

function unixSecondsDaysAgo(daysAgo: number) {
  const nowSec = Math.floor(Date.now() / 1000);
  const delta = Math.floor(daysAgo * 24 * 60 * 60);
  return nowSec - delta;
}

const tokenMintQuerySchema = z.object({
  tokenMint: z.string().min(20),
});

type AgentAuthSession = {
  secret: string;
  expiresAtMs: number;
};

// In-memory store for agent auth secrets from `/agent/auth/init`.
// This avoids ever returning `secret` to the browser.
const agentAuthSessions = new Map<string, AgentAuthSession>();

// Lightweight TTL caching for demo resilience.
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS ?? 30_000);
let tokenFeedCache: { value: unknown; expiresAtMs: number } | null = null;
const insightsCache = new Map<string, { value: unknown; expiresAtMs: number }>();

app.use(express.static("public"));

app.get("/api/royalty/insights", async (req, res) => {
  const q = tokenMintQuerySchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ success: false, error: "Invalid query parameters" });

  const tokenMint = q.data.tokenMint;
  const from = unixSecondsDaysAgo(RECENT_PERIOD_DAYS);
  const to = Math.floor(Date.now() / 1000);
  const cacheKey = `${tokenMint}:${RECENT_PERIOD_DAYS}:${CLAIM_INACTIVITY_DAYS}`;

  const cached = insightsCache.get(cacheKey);
  if (cached && cached.expiresAtMs > Date.now()) {
    return res.json({ success: true, response: cached.value });
  }

  try {
    const [claimStats, lifetimeFees, claimEvents] = await Promise.all([
      getTokenClaimStats(tokenMint),
      getTokenLifetimeFees(tokenMint),
      getTokenClaimEvents({ tokenMint, mode: "time", from, to }),
    ]);

    const insights = buildInsights({
      tokenMint,
      lifetimeFeesLamports: lifetimeFees,
      creatorClaimStats: claimStats,
      claimEvents,
      inactivityThresholdDays: CLAIM_INACTIVITY_DAYS,
      recentPeriodDays: RECENT_PERIOD_DAYS,
    });

    res.json({ success: true, response: insights });

    insightsCache.set(cacheKey, {
      value: insights,
      expiresAtMs: Date.now() + CACHE_TTL_MS,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

const planSchema = z.object({
  tokenMint: z.string().min(20),
  inputMint: z.string().min(20),
  slippageBps: z.number().min(0).max(10000).default(300),
  actionText: z.string().min(3),
});

app.post("/api/ai/plan-buyback", async (req, res) => {
  const body = planSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: "Invalid request body" });

  const { tokenMint, inputMint, slippageBps, actionText } = body.data;
  const to = Math.floor(Date.now() / 1000);

  try {
    if (inputMint !== WSOL_MINT) {
      return res.status(400).json({
        success: false,
        error:
          `Buyback planning currently requires inputMint to be wSOL (lamports-compatible). ` +
          `Expected inputMint=${WSOL_MINT}`,
      });
    }

    const budgetPeriodDays = parseTimeWindowDaysFromText(actionText) ?? RECENT_PERIOD_DAYS;
    const from = unixSecondsDaysAgo(budgetPeriodDays);

    const claimEvents = await getTokenClaimEvents({ tokenMint, mode: "time", from, to });
    const treasuryLamports = claimEvents
      .filter((e) => e.isCreator)
      .reduce<bigint>((acc, e) => acc + toBigIntSafe(e.amount), 0n);

    if (treasuryLamports <= 0n) {
      return res.status(200).json({
        success: true,
        response: {
          tokenMint,
          inputMint,
          slippageBps,
          budgetLamports: "0",
          budgetSol: "0",
          parsedPercent: null,
          note:
            "No creator claim events found in the selected window, so RoyaltyAI has no treasury budget to size a buyback quote. Expand the time window or try a different token.",
        },
      });
    }

    const percent = parsePercentFromText(actionText) ?? 20;
    if (percent > 100) return res.status(400).json({ success: false, error: "Percent must be <= 100" });
    if (percent <= 0) return res.status(400).json({ success: false, error: "Percent must be > 0" });

    const budgetLamports = (treasuryLamports * BigInt(Math.floor(percent * 100))) / BigInt(10000);
    if (budgetLamports <= 0n) {
      return res.status(400).json({ success: false, error: "Parsed buyback budget is <= 0" });
    }

    const quoteResponse = await getTradeQuote({
      inputMint,
      outputMint: tokenMint,
      amount: budgetLamports.toString(),
      slippageMode: "manual",
      slippageBps,
    });

    res.json({
      success: true,
      response: {
        tokenMint,
        inputMint,
        slippageBps,
        parsedPercent: percent,
        recentPeriodDays: budgetPeriodDays,
        treasuryLamports,
        treasurySol: formatLamportsSol(treasuryLamports),
        budgetLamports: budgetLamports.toString(),
        budgetSol: formatLamportsSol(budgetLamports),
        quoteResponse,
        note:
          "This is a quote + plan only. To actually swap, you must create a swap transaction (swap-tx) and sign it with a wallet.",
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

const swapTxSchema = z.object({
  quoteResponse: z.any(),
  userPublicKey: z.string().min(20),
});

app.post("/api/trade/swap-tx", async (req, res) => {
  const body = swapTxSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: "Invalid request body" });

  try {
    const swapTx = await createSwapTransaction({
      quoteResponse: body.data.quoteResponse,
      userPublicKey: body.data.userPublicKey,
    });
    res.json({ success: true, response: swapTx });
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

const claimTxSchema = z.object({
  feeClaimer: z.string().min(20),
  tokenMint: z.string().min(20),
});

app.post("/api/token/claim-txs/v3", async (req, res) => {
  const body = claimTxSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: "Invalid request body" });

  try {
    const txs = await getClaimTransactionsV3(body.data);
    res.json({ success: true, response: txs });
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

app.get("/api/token/feed", async (_req, res) => {
  try {
    if (tokenFeedCache && tokenFeedCache.expiresAtMs > Date.now()) {
      return res.json({ success: true, response: tokenFeedCache.value });
    }

    const feed = await getTokenLaunchFeed();
    tokenFeedCache = { value: feed, expiresAtMs: Date.now() + CACHE_TTL_MS };
    res.json({ success: true, response: feed });
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

const agentAuthInitSchema = z.object({
  agentUsername: z.string().min(3),
});

app.post("/api/agent/auth/init", async (req, res) => {
  const body = agentAuthInitSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: "Invalid request body" });

  try {
    const init = await agentAuthInit({ agentUsername: body.data.agentUsername });
    // Bags sessions expire after 15 minutes. Store secret only server-side.
    agentAuthSessions.set(init.publicIdentifier, {
      secret: init.secret,
      expiresAtMs: Date.now() + 15 * 60 * 1000,
    });

    res.json({
      success: true,
      response: {
        publicIdentifier: init.publicIdentifier,
        agentUsername: init.agentUsername,
        agentUserId: init.agentUserId,
        verificationPostContent: init.verificationPostContent,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

const agentAuthLoginSchema = z.object({
  publicIdentifier: z.string().min(10),
  postId: z.string().min(3),
});

app.post("/api/agent/auth/login", async (req, res) => {
  const body = agentAuthLoginSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: "Invalid request body" });

  const session = agentAuthSessions.get(body.data.publicIdentifier);
  if (!session || session.expiresAtMs < Date.now()) {
    agentAuthSessions.delete(body.data.publicIdentifier);
    return res.status(400).json({ success: false, error: "Agent auth session not found or expired. Start again." });
  }

  // Each auth session can only be used once.
  agentAuthSessions.delete(body.data.publicIdentifier);

  try {
    const login = await agentAuthLogin({
      publicIdentifier: body.data.publicIdentifier,
      secret: session.secret,
      postId: body.data.postId,
    });

    res.json({ success: true, response: login });
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

const agentWalletListSchema = z.object({
  token: z.string().min(10),
});

app.post("/api/agent/wallet/list", async (req, res) => {
  const body = agentWalletListSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: "Invalid request body" });

  try {
    const wallets = await agentWalletList({ token: body.data.token });
    res.json({ success: true, response: wallets });
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

const bulkClaimSchema = z.object({
  tokenMint: z.string().min(20),
  feeClaimers: z.array(z.string().min(20)).min(1).max(20),
});

app.post("/api/token/claim-txs/v3/bulk", async (req, res) => {
  const body = bulkClaimSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: "Invalid request body" });

  const { tokenMint, feeClaimers } = body.data;
  try {
    const results: Array<{
      feeClaimer: string;
      txs?: Array<{ tx: string; blockhash: { blockhash: string; lastValidBlockHeight: number } }>;
      error?: string;
    }> = [];

    // Sequential to reduce bursts/rate-limit pressure during demos.
    for (const feeClaimer of feeClaimers) {
      try {
        const txs = await getClaimTransactionsV3({ tokenMint, feeClaimer });
        results.push({ feeClaimer, txs });
      } catch (e) {
        results.push({ feeClaimer, error: e instanceof Error ? e.message : String(e) });
      }
    }

    res.json({ success: true, response: results });
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`RoyaltyAI server running on http://localhost:${PORT}`);
});

