import type { ScoringMode } from "@prisma/client";
import type { LoadedErrorReason, LoadedSection } from "@/lib/config/loader";

/**
 * Per-call scoring result for one section, produced by a scoring-mode plugin.
 *
 * `accountNumerator` / `accountDenominator` are this call's contribution to the
 * Account-lens accuracy `1 − Σnumerator / Σdenominator` (§5.4). That single
 * formula unifies both modes: binary contributes (errors, 1 call), graded
 * contributes (failed units, N attributes) — so summing over a period gives
 * `1 − errors/calls` for binary and `1 − failed/(N×calls)` for graded.
 */
export interface SectionCallScore {
  /** Per-call section accuracy in [0,1]. */
  accuracy: number;
  /** Raw count of flagged errors in the section for this call (Pareto, sum_of_criticals). */
  errorCount: number;
  accountNumerator: number;
  accountDenominator: number;
}

/**
 * A scoring mode (§5) — how a section turns its flagged errors into accuracy.
 * Modes are a registry (Appendix H): the engine dispatches on the section's
 * `scoringMode`; it never branches on a section code.
 */
export interface ScoringPlugin {
  readonly mode: ScoringMode;
  scoreCall(section: LoadedSection, flaggedReasons: LoadedErrorReason[]): SectionCallScore;
}

/** A single call scored across every section, with the call-level rollups. */
export interface ScoredCall {
  /** sectionId → per-call score for that section. */
  perSection: Map<number, SectionCallScore>;
  /** Total errors in critical sections (§5.4). */
  sumOfCriticals: number;
  /** Any critical error fails the scorecard (sum_of_criticals ≥ 1). */
  failedScorecard: boolean;
}

export type LensStatus = "pass" | "fail" | "na";

/** One lens's accuracy + benchmark comparison for a single section (§5.4/5.8). */
export interface LensSectionResult {
  sectionId: number;
  /** Accuracy in [0,1], or NaN when the denominator is 0 (rendered n/a, FR-26). */
  accuracy: number;
  benchmark: number | undefined;
  status: LensStatus;
}

export interface LensResult {
  lensKey: string;
  /** True when the lens's basis is not yet reconciled (Program/Agent, §5.4). */
  provisional: boolean;
  /** sectionId → this lens's result for that section. */
  sections: Map<number, LensSectionResult>;
}
