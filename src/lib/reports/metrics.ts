import { LensBasis, type Prisma } from "@prisma/client";
import type { LoadedConfig, LoadedLens } from "@/lib/config/loader";
import { prisma } from "@/lib/db/client";
import { computeLens, isLensProvisional } from "@/lib/engine/lenses";
import { computeAgentRank } from "@/lib/engine/rank";
import { agentSectionAccuracy, scoreCall } from "@/lib/engine/score";
import type { LensStatus, ScoredCall } from "@/lib/engine/types";

/**
 * Reporting metric layer (task 9, FR-42/46). Every figure a chart shows is
 * derived here through the SAME engine the score sheet uses — the charts are a
 * pure view over `buildReport`, which is unit-testable off the DB.
 *
 * Reports are a LIVE view: calls in scope are re-derived under the ACTIVE config
 * (so a config change is reflected immediately), the same choice the agent
 * dashboard makes. Historical, stamped figures stay reproducible via the engine
 * loading each evaluation's own config version.
 *
 * Scope is Account → TL → Agent. "Program" is only a lens *basis* name, not a
 * stored dimension (no `program` field on Agent), so it is not a scope here.
 */

export type ReportScope =
  { kind: "account" } | { kind: "tl"; tlName: string } | { kind: "agent"; loginId: number };

/** One in-scope call reduced to what the engine needs. */
export interface ReportCall {
  agentLoginId: number;
  agentName: string;
  reasonIds: number[];
  failedScorecard: boolean;
}

export interface SectionMetric {
  sectionId: number;
  code: string;
  label: string;
  accuracy: number;
  benchmark: number | undefined;
  status: LensStatus;
  /** Change in accuracy vs the previous period (fraction, +/-), or null. */
  delta: number | null;
}

export interface AgentSectionCell {
  sectionId: number;
  accuracy: number;
  status: LensStatus;
}
export interface AgentComparisonRow {
  loginId: number;
  agentName: string;
  cells: AgentSectionCell[];
  /** Mean section accuracy — the worst-first sort key. */
  meanAccuracy: number;
}

export interface LeaderboardRow {
  loginId: number;
  agentName: string;
  rank: number;
}

export interface ReportKpis {
  callCount: number;
  agentCount: number;
  passRate: number;
  passRateDelta: number | null;
}

export interface Report {
  sections: SectionMetric[];
  agentComparison: AgentComparisonRow[];
  leaderboard: LeaderboardRow[];
  kpis: ReportKpis;
  lensKey: string;
  lensProvisional: boolean;
}

const mean = (xs: number[]): number =>
  xs.length === 0 ? Number.NaN : xs.reduce((a, b) => a + b, 0) / xs.length;

/** The Account (per_error) lens, or the first configured lens as a fallback. */
export function pickLens(config: LoadedConfig, key?: string): LoadedLens | null {
  if (key) {
    const byKey = config.lenses.find((l) => l.key === key);
    if (byKey) return byKey;
  }
  return config.lenses.find((l) => l.basis === LensBasis.PER_ERROR) ?? config.lenses[0] ?? null;
}

/**
 * Build every chart's data for a scope × period, given the calls in that period
 * (and the previous period, for deltas). Pure — no DB, no config-version choice.
 */
export function buildReport(
  config: LoadedConfig,
  lens: LoadedLens,
  current: ReportCall[],
  previous: ReportCall[] = [],
): Report {
  const score = (c: ReportCall): ScoredCall => scoreCall(config, c.reasonIds);
  const curScored = current.map(score);
  const prevScored = previous.map(score);

  const curLens = computeLens(lens, config, curScored);
  const prevLens = computeLens(lens, config, prevScored);

  // Chart #1 + KPI tiles: scope-wide section accuracy vs benchmark, with delta.
  const sections: SectionMetric[] = config.sections.map((s) => {
    const cur = curLens.sections.get(s.id);
    const prev = prevLens.sections.get(s.id);
    const accuracy = cur?.accuracy ?? Number.NaN;
    const prevAcc = prev?.accuracy ?? Number.NaN;
    const delta =
      previous.length > 0 && !Number.isNaN(accuracy) && !Number.isNaN(prevAcc)
        ? accuracy - prevAcc
        : null;
    return {
      sectionId: s.id,
      code: s.code,
      label: s.label,
      accuracy,
      benchmark: cur?.benchmark,
      status: cur?.status ?? "na",
      delta,
    };
  });

  // Group by agent for the per-agent charts.
  const byAgent = new Map<number, ReportCall[]>();
  for (const c of current) {
    const list = byAgent.get(c.agentLoginId);
    if (list) list.push(c);
    else byAgent.set(c.agentLoginId, [c]);
  }

  // Chart #4: agent × section accuracy (via the chosen lens), worst-first.
  const agentComparison: AgentComparisonRow[] = [...byAgent.entries()]
    .map(([loginId, calls]) => {
      const scored = calls.map(score);
      const lr = computeLens(lens, config, scored);
      const cells: AgentSectionCell[] = config.sections.map((s) => {
        const r = lr.sections.get(s.id);
        return { sectionId: s.id, accuracy: r?.accuracy ?? Number.NaN, status: r?.status ?? "na" };
      });
      return {
        loginId,
        agentName: calls[0].agentName,
        cells,
        meanAccuracy: mean(cells.map((c) => c.accuracy).filter((a) => !Number.isNaN(a))),
      };
    })
    .sort((a, b) => {
      // Worst (lowest mean accuracy) first; n/a sinks to the bottom.
      if (Number.isNaN(a.meanAccuracy)) return 1;
      if (Number.isNaN(b.meanAccuracy)) return -1;
      return a.meanAccuracy - b.meanAccuracy;
    });

  // Chart #5: rank per agent (rank is lens-independent — §5.3 vs rank benchmark).
  const leaderboard: LeaderboardRow[] = [...byAgent.entries()]
    .map(([loginId, calls]) => ({
      loginId,
      agentName: calls[0].agentName,
      rank: computeAgentRank(config, agentSectionAccuracy(config, calls.map(score))),
    }))
    .sort((a, b) => b.rank - a.rank);

  const passRate = current.length
    ? current.filter((c) => !c.failedScorecard).length / current.length
    : Number.NaN;
  const prevPassRate = previous.length
    ? previous.filter((c) => !c.failedScorecard).length / previous.length
    : Number.NaN;

  return {
    sections,
    agentComparison,
    leaderboard,
    kpis: {
      callCount: current.length,
      agentCount: byAgent.size,
      passRate,
      passRateDelta:
        previous.length > 0 && !Number.isNaN(passRate) && !Number.isNaN(prevPassRate)
          ? passRate - prevPassRate
          : null,
    },
    lensKey: lens.key,
    lensProvisional: isLensProvisional(lens.basis),
  };
}

// --- DB loading -------------------------------------------------------------

function scopeWhere(scope: ReportScope): Prisma.EvaluationWhereInput {
  switch (scope.kind) {
    case "agent":
      return { agentLoginId: scope.loginId };
    case "tl":
      return { agent: { tlName: scope.tlName } };
    case "account":
      return {};
  }
}

async function loadCalls(scope: ReportScope, periodId: number): Promise<ReportCall[]> {
  const rows = await prisma.evaluation.findMany({
    where: { supersededAt: null, periodId, ...scopeWhere(scope) },
    select: {
      agentLoginId: true,
      failedScorecard: true,
      agent: { select: { agentName: true } },
      lines: { select: { errorReasonId: true } },
    },
  });
  return rows.map((r) => ({
    agentLoginId: r.agentLoginId,
    agentName: r.agent.agentName,
    failedScorecard: r.failedScorecard,
    reasonIds: r.lines.map((l) => l.errorReasonId),
  }));
}

/** Load + build a report for a scope × period (with the previous period for deltas). */
export async function loadReport(
  config: LoadedConfig,
  lens: LoadedLens,
  scope: ReportScope,
  periodId: number,
  previousPeriodId: number | null,
): Promise<Report> {
  const [current, previous] = await Promise.all([
    loadCalls(scope, periodId),
    previousPeriodId != null ? loadCalls(scope, previousPeriodId) : Promise.resolve([]),
  ]);
  return buildReport(config, lens, current, previous);
}
