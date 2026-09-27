import { resolveStoredFlags, type LoadedConfig } from "@/lib/config/loader";
import { prisma } from "@/lib/db/client";
import { agentSectionAccuracy, scoreCall } from "@/lib/engine/score";
import type { ScoredCall } from "@/lib/engine/types";
import { scopeWhere, sliceWhere, type ReportScope, type TimeSlice } from "./metrics";

/**
 * Drill-down data (item 2): the raw, per-call rows behind every report figure.
 * A chart or KPI card links here; the page re-derives each call through the same
 * engine so what you see is exactly what the aggregates were computed from.
 */

export interface CallSectionDetail {
  sectionId: number;
  code: string;
  /** This call's per-section accuracy (0/1 for binary, graded fraction for NC). */
  accuracy: number;
  errorCount: number;
}

export interface CallFlag {
  sectionCode: string;
  attribute: string;
  reason: string;
}

export interface CallDetailRow {
  evalId: string;
  agentLoginId: number;
  agentName: string;
  callDate: Date;
  callType: string | null;
  /** Phone number, stored masked (PII) — last 4 digits only. */
  phoneMasked: string | null;
  failedScorecard: boolean;
  reasonIds: number[];
  sections: CallSectionDetail[];
  flags: CallFlag[];
  /** Flags on this call the current rubric no longer contains (absent = none). */
  unresolved?: number;
}

/** Every in-scope call in a time slice, scored to per-section detail + flag labels. */
export async function loadCallDetails(
  config: LoadedConfig,
  scope: ReportScope,
  slice: TimeSlice,
): Promise<CallDetailRow[]> {
  const rows = await prisma.evaluation.findMany({
    where: { supersededAt: null, ...sliceWhere(slice), ...scopeWhere(scope) },
    select: {
      evalId: true,
      agentLoginId: true,
      callDate: true,
      callType: true,
      mobileMasked: true,
      failedScorecard: true,
      agent: { select: { agentName: true } },
      // Stable key, not the version-scoped id (see resolveStoredFlags).
      lines: { select: { errorReason: { select: { key: true } } } },
    },
    orderBy: [{ callDate: "asc" }, { evalId: "asc" }],
  });

  const attrLabelById = new Map<number, string>();
  for (const s of config.sections) for (const a of s.attributes) attrLabelById.set(a.id, a.label);

  return rows.map((r) => {
    const { reasonIds, unresolved } = resolveStoredFlags(
      config,
      r.lines.map((l) => l.errorReason.key),
    );
    const scored = scoreCall(config, reasonIds);
    const sections: CallSectionDetail[] = config.sections.map((s) => {
      const sc = scored.perSection.get(s.id);
      return {
        sectionId: s.id,
        code: s.code,
        accuracy: sc?.accuracy ?? Number.NaN,
        errorCount: sc?.errorCount ?? 0,
      };
    });
    const flags: CallFlag[] = reasonIds.flatMap((id) => {
      const reason = config.errorReasonById.get(id);
      if (!reason) return [];
      return [
        {
          sectionCode: config.sectionById.get(reason.sectionId)?.code ?? "?",
          attribute: attrLabelById.get(reason.attributeId) ?? "?",
          reason: reason.label,
        },
      ];
    });
    return {
      evalId: r.evalId,
      agentLoginId: r.agentLoginId,
      agentName: r.agent.agentName,
      callDate: r.callDate,
      callType: r.callType,
      phoneMasked: r.mobileMasked,
      failedScorecard: r.failedScorecard,
      reasonIds,
      sections,
      flags,
      unresolved,
    };
  });
}

export interface RankSectionBreakdown {
  sectionId: number;
  code: string;
  accuracy: number;
  rankBenchmark: number;
  weight: number;
  met: boolean;
  earned: number;
}

/**
 * How an agent's rank is built (§5.6): each section earns its full weight iff the
 * agent's section accuracy meets that section's rank benchmark. `rank` = Σ earned.
 */
export function rankBreakdown(
  config: LoadedConfig,
  calls: ScoredCall[],
): { sections: RankSectionBreakdown[]; rank: number } {
  const acc = agentSectionAccuracy(config, calls);
  const sections = config.sections.map((s) => {
    const a = acc.get(s.id) ?? Number.NaN;
    const met = !Number.isNaN(a) && a >= s.rankBenchmark;
    return {
      sectionId: s.id,
      code: s.code,
      accuracy: a,
      rankBenchmark: s.rankBenchmark,
      weight: s.rankWeight,
      met,
      earned: met ? s.rankWeight : 0,
    };
  });
  return { sections, rank: sections.reduce((sum, x) => sum + x.earned, 0) };
}

export { scoreCall };
