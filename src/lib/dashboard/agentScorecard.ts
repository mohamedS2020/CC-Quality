import { LensBasis } from "@prisma/client";
import type { LoadedConfig } from "@/lib/config/loader";
import { prisma } from "@/lib/db/client";
import { computeErrorAnalytics } from "@/lib/engine/analytics";
import { computeLens, isLensProvisional } from "@/lib/engine/lenses";
import { computeAgentRank } from "@/lib/engine/rank";
import { agentSectionAccuracy, scoreCall } from "@/lib/engine/score";
import type { LensStatus, ScoredCall } from "@/lib/engine/types";

/**
 * The Agent self-service scorecard (FR-33..37). Builds an agent's period metrics
 * from their calls entirely through the engine:
 *  - section accuracy + pass/fail via the VERIFIED Account lens (per_error),
 *  - Agent Rank + per-section rank-benchmark status,
 *  - training recommendations from error → training bucket.
 * The pure `buildScorecard` keeps the metric logic unit-testable off the DB.
 */

export interface SectionAccuracyRow {
  sectionId: number;
  code: string;
  label: string;
  accuracy: number;
  benchmark: number | undefined;
  status: LensStatus;
}

export interface RankSectionRow {
  code: string;
  accuracy: number;
  benchmark: number;
  met: boolean;
}

export interface TrainingRow {
  bucket: string;
  count: number;
}

export interface AgentScorecard {
  callCount: number;
  sectionAccuracy: SectionAccuracyRow[];
  rank: number;
  rankBySection: RankSectionRow[];
  training: TrainingRow[];
}

/** One call reduced to the flagged reason ids the engine scores. */
export interface CallReasons {
  reasonIds: number[];
}

export function buildScorecard(config: LoadedConfig, calls: CallReasons[]): AgentScorecard {
  const scored: ScoredCall[] = calls.map((c) => scoreCall(config, c.reasonIds));

  // Section accuracy + pass/fail via the reconciled Account lens (per_error).
  const accountLens = config.lenses.find((l) => l.basis === LensBasis.PER_ERROR);
  const lens = accountLens ? computeLens(accountLens, config, scored) : null;
  const sectionAccuracy: SectionAccuracyRow[] = config.sections.map((s) => {
    const r = lens?.sections.get(s.id);
    return {
      sectionId: s.id,
      code: s.code,
      label: s.label,
      accuracy: r?.accuracy ?? Number.NaN,
      benchmark: r?.benchmark,
      status: r?.status ?? "na",
    };
  });

  // Rank uses the §5.3 agent×section accuracy vs each section's rank benchmark.
  const agentAcc = agentSectionAccuracy(config, scored);
  const rank = computeAgentRank(config, agentAcc);
  const rankBySection: RankSectionRow[] = config.sections.map((s) => {
    const acc = agentAcc.get(s.id) ?? Number.NaN;
    return {
      code: s.code,
      accuracy: acc,
      benchmark: s.rankBenchmark,
      met: !Number.isNaN(acc) && acc >= s.rankBenchmark,
    };
  });

  // Training recommendations: which buckets the agent's errors map to, most first.
  const analytics = computeErrorAnalytics(
    config,
    calls.flatMap((c) => c.reasonIds),
  );
  const training: TrainingRow[] = [...analytics.trainingBucketCounts.entries()]
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => b.count - a.count);

  return { callCount: calls.length, sectionAccuracy, rank, rankBySection, training };
}

/** Whether the Account lens (per_error) is available + reconciled for display. */
export function accountLensVerified(config: LoadedConfig): boolean {
  const lens = config.lenses.find((l) => l.basis === LensBasis.PER_ERROR);
  return lens ? !isLensProvisional(lens.basis) : false;
}

export interface AgentCall {
  evalId: string;
  callDate: Date;
  overallStatus: string | null;
  failedScorecard: boolean;
}

/** The agent's current calls in a period + the derived scorecard. */
export async function loadAgentScorecard(
  config: LoadedConfig,
  agentLoginId: number,
  periodId: number,
): Promise<{ scorecard: AgentScorecard; calls: AgentCall[] }> {
  const evals = await prisma.evaluation.findMany({
    where: { agentLoginId, periodId, supersededAt: null },
    orderBy: [{ callDate: "desc" }, { creationDate: "desc" }],
    select: {
      evalId: true,
      callDate: true,
      overallStatus: true,
      failedScorecard: true,
      lines: { select: { errorReasonId: true } },
    },
  });

  const scorecard = buildScorecard(
    config,
    evals.map((e) => ({ reasonIds: e.lines.map((l) => l.errorReasonId) })),
  );
  const calls: AgentCall[] = evals.map((e) => ({
    evalId: e.evalId,
    callDate: e.callDate,
    overallStatus: e.overallStatus,
    failedScorecard: e.failedScorecard,
  }));
  return { scorecard, calls };
}

/** Periods (newest first) in which this agent has current calls — for the picker. */
export function agentPeriods(agentLoginId: number) {
  return prisma.period.findMany({
    where: { evaluations: { some: { agentLoginId, supersededAt: null } } },
    orderBy: [{ label: "desc" }],
    select: { id: true, label: true },
  });
}
