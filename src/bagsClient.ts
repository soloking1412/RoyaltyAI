import { z } from "zod";

const BAGS_BASE_URL =
  process.env.BAGS_BASE_URL ?? "https://public-api-v2.bags.fm/api/v1";

const BAGS_API_KEY = process.env.BAGS_API_KEY;

if (!BAGS_API_KEY) {
  // We don't throw at import time because it breaks tooling; routes will validate.
  // eslint-disable-next-line no-console
  console.warn("Warning: BAGS_API_KEY is not set. /api routes will fail.");
}

const SuccessResponseSchema = z.object({
  success: z.boolean(),
});

const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

async function bagsFetchJson(path: string, query: Record<string, string | number | undefined> = {}) {
  if (!BAGS_API_KEY) throw new Error("BAGS_API_KEY is not set");

  const url = new URL(`${BAGS_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-api-key": BAGS_API_KEY,
    },
  });

  const json = await res.json().catch(() => ({}));

  if (!SuccessResponseSchema.safeParse(json).success) {
    // Fall back to a best-effort error format
    const parsedErr = errorResponseSchema.safeParse(json);
    if (parsedErr.success) throw new Error(parsedErr.data.error);
    throw new Error(`Bags API request failed (${res.status})`);
  }

  if (json.success !== true) {
    const parsedErr = errorResponseSchema.safeParse(json);
    if (parsedErr.success) throw new Error(parsedErr.data.error);
    throw new Error("Bags API returned success=false");
  }

  return json;
}

async function bagsPostJson<T>(path: string, body: unknown, query: Record<string, string | number | undefined> = {}) {
  if (!BAGS_API_KEY) throw new Error("BAGS_API_KEY is not set");

  const url = new URL(`${BAGS_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "x-api-key": BAGS_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (json?.success !== true) {
    const parsedErr = errorResponseSchema.safeParse(json);
    if (parsedErr.success) throw new Error(parsedErr.data.error);
    throw new Error(`Bags API POST failed (${res.status})`);
  }

  return json as T;
}

export type TokenLaunchCreator = {
  username: string;
  pfp: string;
  royaltyBps: number;
  isCreator: boolean;
  wallet: string;
  provider: string | null;
  providerUsername: string | null;
  twitterUsername?: string;
  bagsUsername?: string;
  isAdmin?: boolean;
};

export type TokenLaunchCreatorWithClaimStats = {
  username: string;
  pfp: string;
  royaltyBps: number;
  isCreator: boolean;
  wallet: string;
  provider: string | null;
  providerUsername: string | null;
  twitterUsername?: string;
  bagsUsername?: string;
  isAdmin?: boolean;
  totalClaimed: string;
};

export async function getTokenLaunchCreators(tokenMint: string): Promise<TokenLaunchCreator[]> {
  const json = await bagsFetchJson("/token-launch/creator/v3", { tokenMint });
  return json.response as TokenLaunchCreator[];
}

export async function getTokenClaimStats(tokenMint: string): Promise<TokenLaunchCreatorWithClaimStats[]> {
  const json = await bagsFetchJson("/token-launch/claim-stats", { tokenMint });
  return json.response as TokenLaunchCreatorWithClaimStats[];
}

export async function getTokenLifetimeFees(tokenMint: string): Promise<string> {
  const json = await bagsFetchJson("/token-launch/lifetime-fees", { tokenMint });
  return json.response as string;
}

export type TokenLaunchStatus = "PRE_LAUNCH" | "PRE_GRAD" | "MIGRATING" | "MIGRATED";

export type TokenLaunchFeedItem = {
  name: string;
  symbol: string;
  description: string;
  image: string;
  tokenMint: string;
  status: TokenLaunchStatus;
  twitter: string | null;
  website: string | null;
  launchSignature: string | null;
  uri: string | null;
  dbcPoolKey: string | null;
  dbcConfigKey: string | null;
};

export async function getTokenLaunchFeed(): Promise<TokenLaunchFeedItem[]> {
  const json = await bagsFetchJson("/token-launch/feed", {});
  return json.response as TokenLaunchFeedItem[];
}

export type TokenClaimEvent = {
  wallet: string;
  isCreator: boolean;
  amount: string; // lamports as string (bigint safe)
  signature: string;
  timestamp: string; // ISO 8601
};

export async function getTokenClaimEvents(params: {
  tokenMint: string;
  mode?: "offset" | "time";
  limit?: number;
  offset?: number;
  from?: number;
  to?: number;
}): Promise<TokenClaimEvent[]> {
  const { tokenMint, mode = "offset", limit, offset, from, to } = params;
  const json = await bagsFetchJson("/fee-share/token/claim-events", {
    tokenMint,
    mode,
    limit,
    offset,
    from,
    to,
  });
  return (json.response?.events ?? []) as TokenClaimEvent[];
}

export type TradeQuoteResponse = {
  requestId: string;
  contextSlot: number;
  inAmount: string;
  inputMint: string;
  outAmount: string;
  outputMint: string;
  minOutAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  slippageBps: number;
  routePlan: Array<{
    venue: string;
    inAmount: string;
    outAmount: string;
    inputMint: string;
    outputMint: string;
    inputMintDecimals: number;
    outputMintDecimals: number;
    marketKey: string;
    data: string;
  }>;
  platformFee: unknown;
  outTransferFee?: string | null;
  simulatedComputeUnits?: number | null;
};

export async function getTradeQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: number | string;
  slippageMode?: "auto" | "manual";
  slippageBps?: number;
}): Promise<TradeQuoteResponse> {
  const json = await bagsFetchJson("/trade/quote", {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippageMode: params.slippageMode,
    slippageBps: params.slippageBps,
  });
  return json.response as TradeQuoteResponse;
}

export async function createSwapTransaction(params: {
  quoteResponse: TradeQuoteResponse;
  userPublicKey: string;
}): Promise<{
  swapTransaction: string; // base58 serialized VersionedTransaction
  computeUnitLimit: number;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}> {
  const json = await bagsPostJson<{
    response: {
      swapTransaction: string;
      computeUnitLimit: number;
      lastValidBlockHeight: number;
      prioritizationFeeLamports: number;
    };
  }>("/trade/swap", { quoteResponse: params.quoteResponse, userPublicKey: params.userPublicKey });

  return json.response;
}

export async function getClaimTransactionsV3(params: {
  feeClaimer: string;
  tokenMint: string;
}): Promise<Array<{ tx: string; blockhash: { blockhash: string; lastValidBlockHeight: number } }>> {
  const json = await bagsPostJson<{
    response: Array<{ tx: string; blockhash: { blockhash: string; lastValidBlockHeight: number } }>;
  }>("/token-launch/claim-txs/v3", params);
  return json.response;
}

export async function agentAuthInit(params: { agentUsername: string }): Promise<{
  publicIdentifier: string;
  secret: string;
  agentUsername: string;
  agentUserId: string;
  verificationPostContent: string;
}> {
  const json = await bagsPostJson<{
    response: {
      publicIdentifier: string;
      secret: string;
      agentUsername: string;
      agentUserId: string;
      verificationPostContent: string;
    };
  }>("/agent/auth/init", params);

  return json.response;
}

export async function agentAuthLogin(params: {
  publicIdentifier: string;
  secret: string;
  postId: string;
}): Promise<{ token: string }> {
  const json = await bagsPostJson<{
    response: { token: string };
  }>("/agent/auth/login", params);

  return json.response;
}

export async function agentWalletList(params: { token: string }): Promise<string[]> {
  const json = await bagsPostJson<{
    response: string[];
  }>("/agent/wallet/list", params);

  return json.response;
}

