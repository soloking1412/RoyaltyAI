export function parsePercentFromText(text: string): number | null {
  // Handles strings like "use 20% ...", "20 percent", "20 %", etc.
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)\b/i);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return n;
}

export function parseTimeWindowDaysFromText(text: string): number | null {
  const lower = text.toLowerCase();

  // Prefer explicit "last/past N days" style.
  const explicit = lower.match(/(?:last|past)\s*(\d{1,4})\s*(?:d|day|days)\b/);
  if (explicit) {
    const n = Number(explicit[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // Allow "N d" / "N days" anywhere (still require a day token).
  const loose = lower.match(/\b(\d{1,4})\s*(?:d|day|days)\b/);
  if (loose) {
    const n = Number(loose[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  if (/\bthis\s+week\b/.test(lower) || /\blast\s+week\b/.test(lower) || /\bweek\b/.test(lower)) return 7;
  if (/\bthis\s+month\b/.test(lower) || /\bmonth\b/.test(lower)) return 30;
  if (/\bquarter\b/.test(lower)) return 90;

  return null;
}

export function toBigIntSafe(s: string | number | bigint): bigint {
  if (typeof s === "bigint") return s;
  if (typeof s === "number") return BigInt(Math.trunc(s));
  if (typeof s === "string") {
    if (s.trim() === "") return 0n;
    return BigInt(s);
  }
  return 0n;
}

export function formatLamportsSol(lamports: bigint): string {
  // Lamports -> SOL (9 decimals)
  const sign = lamports < 0n ? "-" : "";
  const abs = lamports < 0n ? -lamports : lamports;
  const intPart = abs / 1_000_000_000n;
  const frac = abs % 1_000_000_000n;
  const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "");
  return fracStr.length ? `${sign}${intPart.toString()}.${fracStr}` : `${sign}${intPart.toString()}`;
}

export function daysBetween(nowMs: number, pastMs: number): number {
  return (nowMs - pastMs) / (1000 * 60 * 60 * 24);
}

export type CreatorClaimStat = {
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

export type CreatorEvent = {
  wallet: string;
  isCreator: boolean;
  amount: string;
  signature: string;
  timestamp: string;
};

export type RoyaltyRecommendation = {
  type: "claim" | "buybackQuote" | "both";
  severity: "info" | "warning";
  title: string;
  detail: string;
  action?: string;
};

export type ClaimersLeaderboardItem = {
  wallet: string;
  username: string;
  royaltyBps: number;
  royaltyPercent: number;
  totalClaimedLamports: string;
  totalClaimedSol: string;
  shareOfCreatorTotalBps: number | null; // 1e4=100%
};

export type RoyaltyAIInsights = {
  tokenMint: string;
  lifetimeFeesLamports: string;
  totalClaimedLamportsAcrossClaimers: string;
  unclaimedLamportsEstimate: string | null;
  creators: ClaimersLeaderboardItem[];
  topClaimers: ClaimersLeaderboardItem[];
  claimVelocity: {
    periodDays: number;
    totalLamports: string;
    totalSol: string;
    lamportsPerDay: string;
    solPerDay: string;
    creatorLamports: string;
    creatorSol: string;
  };
  recentCreatorClaims: {
    periodDays: number;
    totalLamports: string;
    totalSol: string;
    lastClaimedAt: string | null;
    daysSinceLastClaim: number | null;
  };
  recommendations: RoyaltyRecommendation[];
};

export function buildInsights(params: {
  tokenMint: string;
  lifetimeFeesLamports: string;
  creatorClaimStats: CreatorClaimStat[];
  claimEvents: CreatorEvent[];
  inactivityThresholdDays: number;
  recentPeriodDays: number;
}): RoyaltyAIInsights {
  const { tokenMint, lifetimeFeesLamports, creatorClaimStats, claimEvents, inactivityThresholdDays, recentPeriodDays } = params;

  const lifetimeFees = toBigIntSafe(lifetimeFeesLamports);
  const totalClaimed = creatorClaimStats.reduce<bigint>((acc, c) => acc + toBigIntSafe(c.totalClaimed), 0n);
  const unclaimed = lifetimeFees > totalClaimed ? lifetimeFees - totalClaimed : 0n;

  const creatorsOnly = creatorClaimStats.filter((c) => c.isCreator);
  const creators = creatorsOnly.length ? creatorsOnly : creatorClaimStats;

  const creatorTotalClaimed = creatorsOnly.reduce<bigint>((acc, c) => acc + toBigIntSafe(c.totalClaimed), 0n);

  const creatorEvents = claimEvents.filter((e) => e.isCreator);
  const recentTotalLamports = claimEvents.reduce<bigint>((acc, e) => acc + toBigIntSafe(e.amount), 0n);
  const recentCreatorLamports = creatorEvents.reduce<bigint>((acc, e) => acc + toBigIntSafe(e.amount), 0n);

  const lastEvent = creatorEvents
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  const nowMs = Date.now();
  const lastClaimedAt = lastEvent?.timestamp ? new Date(lastEvent.timestamp).toISOString() : null;
  const daysSinceLastClaim =
    lastEvent?.timestamp ? daysBetween(nowMs, new Date(lastEvent.timestamp).getTime()) : null;

  const recommendations: RoyaltyRecommendation[] = [];

  if (unclaimed > 0n) {
    recommendations.push({
      type: "claim",
      severity: "info",
      title: "Unclaimed fees likely exist",
      detail:
        `Bags reports ${formatLamportsSol(unclaimed)} SOL worth of lifetime fees not yet reflected in ` +
        `creator claim totals. Generate claim transactions (v3) and sign/submit with a wallet ` +
        `that owns fee-claim positions.`,
    });
  } else {
    recommendations.push({
      type: "claim",
      severity: "info",
      title: "Claim totals look up to date",
      detail:
        "Lifetime fees and creator claim totals are aligned (or unclaimed is near zero). Claims may be current, " +
        "but check claim events for recent activity.",
    });
  }

  if (daysSinceLastClaim !== null && daysSinceLastClaim >= inactivityThresholdDays) {
    recommendations.push({
      type: "claim",
      severity: "warning",
      title: "Creator claim inactivity detected",
      detail:
        `No creator fee claims observed in the last ${Math.round(daysSinceLastClaim)} days for this token. ` +
        "Consider generating `claim-txs/v3` for the relevant fee claimer wallet(s) and signing with your wallet.",
      action: "Generate claim-txs v3 for your fee claimer wallet and submit if safe.",
    });
  }

  if (creatorEvents.length === 0) {
    recommendations.push({
      type: "claim",
      severity: "warning",
      title: "No creator claim events found",
      detail:
        "The claim-events feed returned no creator-related claim activity in the selected window. " +
        "Confirm the fee claimer wallet(s) and expand the time range if needed.",
    });
  }

  if (recentCreatorLamports > 0n) {
    recommendations.push({
      type: "buybackQuote",
      severity: "info",
      title: "Buyback quote is feasible",
      detail:
        `Recent creator claim activity in this window totals ${formatLamportsSol(recentCreatorLamports)} SOL. ` +
        "RoyaltyAI can generate a buyback swap quote using Bags trade endpoints (quote only).",
    });
  } else {
    recommendations.push({
      type: "buybackQuote",
      severity: "warning",
      title: "Buyback quote may be unreliable",
      detail:
        "No creator claim activity was observed in the selected window; buyback sizing from creator-claimed treasury may end up at zero. " +
        "Try a longer window or ensure your fee-claimer wallet is set up correctly.",
    });
  }

  const claimersSorted = creatorClaimStats
    .slice()
    .sort((a, b) => {
      const av = toBigIntSafe(a.totalClaimed);
      const bv = toBigIntSafe(b.totalClaimed);
      return av === bv ? 0 : av > bv ? -1 : 1;
    })
    .slice(0, 10);

  const toLeaderboardItem = (c: CreatorClaimStat): ClaimersLeaderboardItem => {
    const lamports = toBigIntSafe(c.totalClaimed);
    const shareOfCreatorTotalBps =
      creatorTotalClaimed > 0n ? Number((lamports * 10000n) / creatorTotalClaimed) : null;

    return {
      wallet: c.wallet,
      username: c.username,
      royaltyBps: c.royaltyBps,
      royaltyPercent: c.royaltyBps / 100,
      totalClaimedLamports: lamports.toString(),
      totalClaimedSol: formatLamportsSol(lamports),
      shareOfCreatorTotalBps,
    };
  };

  const creatorsLeaderboard = creatorsOnly.length ? creatorsOnly.map(toLeaderboardItem) : creatorClaimStats.map(toLeaderboardItem);
  const topClaimersLeaderboard = claimersSorted.map(toLeaderboardItem);

  const lamportsPerDay = recentTotalLamports / BigInt(Math.max(1, Math.floor(recentPeriodDays)));
  const solPerDay = formatLamportsSol(lamportsPerDay);

  return {
    tokenMint,
    lifetimeFeesLamports: lifetimeFees.toString(),
    totalClaimedLamportsAcrossClaimers: totalClaimed.toString(),
    unclaimedLamportsEstimate: unclaimed > 0n ? unclaimed.toString() : null,
    creators: creatorsLeaderboard,
    topClaimers: topClaimersLeaderboard,
    claimVelocity: {
      periodDays: recentPeriodDays,
      totalLamports: recentTotalLamports.toString(),
      totalSol: formatLamportsSol(recentTotalLamports),
      lamportsPerDay: lamportsPerDay.toString(),
      solPerDay,
      creatorLamports: recentCreatorLamports.toString(),
      creatorSol: formatLamportsSol(recentCreatorLamports),
    },
    recentCreatorClaims: {
      periodDays: recentPeriodDays,
      totalLamports: recentCreatorLamports.toString(),
      totalSol: formatLamportsSol(recentCreatorLamports),
      lastClaimedAt,
      daysSinceLastClaim,
    },
    recommendations,
  };
}

