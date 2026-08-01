import type { LoadedConfig, LoadedErrorReason } from "@/lib/config/loader";
import type { ScoredCall, SectionCallScore } from "./types";
import { getScoringPlugin } from "./scoring";

/**
 * Score one call across every section (§5.1–5.3). Flagged reasons are grouped
 * by their section and handed to that section's scoring plugin; a section with
 * no flags scores a full pass. Rolls up sum_of_criticals (errors in critical
 * sections) and the failed-scorecard flag (any critical error → failed).
 */
export function scoreCall(config: LoadedConfig, flaggedReasonIds: Iterable<number>): ScoredCall {
  const reasonsBySection = new Map<number, LoadedErrorReason[]>();
  for (const id of flaggedReasonIds) {
    const reason = config.errorReasonById.get(id);
    if (!reason) continue;
    const list = reasonsBySection.get(reason.sectionId);
    if (list) list.push(reason);
    else reasonsBySection.set(reason.sectionId, [reason]);
  }

  const perSection = new Map<number, SectionCallScore>();
  let sumOfCriticals = 0;
  for (const section of config.sections) {
    const flagged = reasonsBySection.get(section.id) ?? [];
    const score = getScoringPlugin(section.scoringMode).scoreCall(section, flagged);
    perSection.set(section.id, score);
    if (section.critical) sumOfCriticals += score.errorCount;
  }

  return { perSection, sumOfCriticals, failedScorecard: sumOfCriticals > 0 };
}

/**
 * Agent × section accuracy (§5.3): the mean of per-call section accuracy across
 * an agent's calls. For graded sections this equals 1 − Σfailed/(N×calls); for
 * binary it is the call pass-rate. This is the number that feeds Agent Rank
 * (§5.6). No calls (or all NaN) → NaN, which higher layers render as n/a.
 */
export function agentSectionAccuracy(
  config: LoadedConfig,
  calls: ScoredCall[],
): Map<number, number> {
  const result = new Map<number, number>();
  for (const section of config.sections) {
    let sum = 0;
    let count = 0;
    for (const call of calls) {
      const accuracy = call.perSection.get(section.id)?.accuracy;
      if (accuracy !== undefined && !Number.isNaN(accuracy)) {
        sum += accuracy;
        count += 1;
      }
    }
    result.set(section.id, count > 0 ? sum / count : Number.NaN);
  }
  return result;
}
