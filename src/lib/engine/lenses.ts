import { LensBasis } from "@prisma/client";
import type { LoadedConfig, LoadedLens, LoadedSection } from "@/lib/config/loader";
import type { LensResult, LensSectionResult, LensStatus, ScoredCall } from "./types";

/**
 * Per-(lens, section) numerator/denominator by error basis (§5.4):
 *
 *  - PER_ERROR (Account, VERIFIED): sum the per-call account contributions →
 *    1 − errors/calls (binary), 1 − failed/(N×calls) (graded). Reconciled
 *    against Appendix C.
 *  - PER_SCORESHEET (Program, PROVISIONAL): score sheets that had an error in
 *    the section, over score sheets.
 *  - FAILED_SCORESHEETS (Agent, PROVISIONAL): failed scorecards over score
 *    sheets — a call-level rate compared to each section's benchmark.
 *
 * ⚠️ Program & Agent are the §5.4 working hypothesis: only Account was
 * reconcilable (April '26 had no critical errors). They stay provisional until
 * confirmed against a critical-error month (task 5.10).
 */
function lensTotals(
  basis: LensBasis,
  section: LoadedSection,
  calls: ScoredCall[],
): { numerator: number; denominator: number } {
  switch (basis) {
    case LensBasis.PER_ERROR: {
      let numerator = 0;
      let denominator = 0;
      for (const call of calls) {
        const score = call.perSection.get(section.id);
        if (score) {
          numerator += score.accountNumerator;
          denominator += score.accountDenominator;
        }
      }
      return { numerator, denominator };
    }
    case LensBasis.PER_SCORESHEET: {
      const numerator = calls.filter(
        (c) => (c.perSection.get(section.id)?.errorCount ?? 0) > 0,
      ).length;
      return { numerator, denominator: calls.length };
    }
    case LensBasis.FAILED_SCORESHEETS: {
      const numerator = calls.filter((c) => c.failedScorecard).length;
      return { numerator, denominator: calls.length };
    }
  }
}

/** Pass/fail vs benchmark using `≥` (§5.8); n/a when accuracy is NaN or no benchmark. */
function statusFor(accuracy: number, benchmark: number | undefined): LensStatus {
  if (Number.isNaN(accuracy) || benchmark === undefined) return "na";
  return accuracy >= benchmark ? "pass" : "fail";
}

/**
 * Bases whose formula is reconciled against data. Only the Account lens
 * (per_error) was verifiable (Appendix C); the score-sheet and failed-scorecard
 * bases are the §5.4 working hypothesis — provisional until confirmed against a
 * critical-error month (PRD Open Q #1).
 */
const VERIFIED_BASES: ReadonlySet<LensBasis> = new Set([LensBasis.PER_ERROR]);

export function isLensProvisional(basis: LensBasis): boolean {
  return !VERIFIED_BASES.has(basis);
}

/** The keys of configured lenses that are still provisional (Program/Agent). */
export function provisionalLensKeys(config: LoadedConfig): string[] {
  return config.lenses.filter((lens) => isLensProvisional(lens.basis)).map((lens) => lens.key);
}

/** Compute one lens across every section for the calls in scope. */
export function computeLens(
  lens: LoadedLens,
  config: LoadedConfig,
  calls: ScoredCall[],
): LensResult {
  const sections = new Map<number, LensSectionResult>();
  for (const section of config.sections) {
    const { numerator, denominator } = lensTotals(lens.basis, section, calls);
    // Divide-by-zero (no data in scope) → NaN, surfaced as n/a downstream (FR-26).
    const accuracy = denominator > 0 ? 1 - numerator / denominator : Number.NaN;
    const benchmark = lens.benchmarks.get(section.id);
    sections.set(section.id, {
      sectionId: section.id,
      accuracy,
      benchmark,
      status: statusFor(accuracy, benchmark),
    });
  }
  return { lensKey: lens.key, provisional: isLensProvisional(lens.basis), sections };
}

/** Compute every configured lens (Account / Program / Agent) for the calls in scope. */
export function computeAllLenses(
  config: LoadedConfig,
  calls: ScoredCall[],
): Map<string, LensResult> {
  const result = new Map<string, LensResult>();
  for (const lens of config.lenses) {
    result.set(lens.key, computeLens(lens, config, calls));
  }
  return result;
}
