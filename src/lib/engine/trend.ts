import type { LoadedConfig, LoadedLens } from "@/lib/config/loader";
import type { LensResult, ScoredCall } from "./types";
import { computeLens } from "./lenses";

export type PeriodGranularity = "month" | "week" | "quarter";

/** A scored call paired with its call date, for period bucketing. */
export interface DatedCall {
  callDate: Date;
  scored: ScoredCall;
}

export interface PeriodTrendPoint {
  period: string;
  callCount: number;
  /** The lens recomputed over only this period's calls (§5.5). */
  lens: LensResult;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * The period bucket key for a call date at a given granularity, from the call
 * date's UTC calendar. Weeks are weeks-of-month W1–W4 (the last week absorbs
 * days 29–31). The exact week/quarter definition is a config-confirm item
 * (Appendix H); this is the working default.
 */
export function periodKey(date: Date, granularity: PeriodGranularity): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  switch (granularity) {
    case "month":
      return `${year}-${pad2(month)}`;
    case "quarter":
      return `${year}-Q${Math.ceil(month / 3)}`;
    case "week": {
      const week = Math.min(Math.ceil(date.getUTCDate() / 7), 4);
      return `${year}-${pad2(month)}-W${week}`;
    }
  }
}

/**
 * Recompute a lens per period to produce a trend (§5.5) — e.g. the account lens
 * by month (`Monthly Account Figures %`) or by week (`Weekly Figures`, W1–W4).
 * Each point's per-section accuracy is the same pure function as §5.4, just
 * scoped to that period's calls. Points are returned sorted by period key.
 */
export function computeTrend(
  lens: LoadedLens,
  config: LoadedConfig,
  calls: DatedCall[],
  granularity: PeriodGranularity,
): PeriodTrendPoint[] {
  const byPeriod = new Map<string, ScoredCall[]>();
  for (const { callDate, scored } of calls) {
    const key = periodKey(callDate, granularity);
    const list = byPeriod.get(key);
    if (list) list.push(scored);
    else byPeriod.set(key, [scored]);
  }

  return [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, scoredCalls]) => ({
      period,
      callCount: scoredCalls.length,
      lens: computeLens(lens, config, scoredCalls),
    }));
}
