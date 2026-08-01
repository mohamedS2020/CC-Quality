import { ScoringMode } from "@prisma/client";
import type { ScoringPlugin } from "../types";

/**
 * `section_binary` (§5.1) — go/no-go. A single error anywhere in the section
 * fails the whole section for the call; the rubric under a binary section only
 * classifies errors (for Pareto), it never grants partial credit. Every error
 * still counts individually toward the Account lens (§5.4), so a call with two
 * errors scores the section 0 but contributes 2 to the account numerator.
 */
export const sectionBinaryPlugin: ScoringPlugin = {
  mode: ScoringMode.SECTION_BINARY,
  scoreCall(_section, flaggedReasons) {
    const errorCount = flaggedReasons.length;
    return {
      accuracy: errorCount === 0 ? 1 : 0,
      errorCount,
      accountNumerator: errorCount,
      accountDenominator: 1,
    };
  },
};
