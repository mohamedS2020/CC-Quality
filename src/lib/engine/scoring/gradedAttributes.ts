import { ScoringMode } from "@prisma/client";
import type { ScoringPlugin } from "../types";

/**
 * `graded_attributes` (§5.2) — accuracy = 1 − failed_units / N.
 *
 *  - N is the DERIVED count of main attributes in the section (attributeCount,
 *    FR-32) — never hardcoded.
 *  - failed_units counts every flagged sub-reason (uncapped — the legacy sheet
 *    default) or the distinct main attributes with ≥1 flag (capped), per the
 *    section's `capPerAttribute`. The two differ only when 2+ sub-reasons hit
 *    one attribute on a call.
 *
 * If N is 0 the accuracy is NaN (a divide-by-zero the Account lens renders as
 * n/a, §5.4); config validation prevents a graded section with no attributes.
 */
export const gradedAttributesPlugin: ScoringPlugin = {
  mode: ScoringMode.GRADED_ATTRIBUTES,
  scoreCall(section, flaggedReasons) {
    const n = section.attributeCount;
    const failedUnits = section.capPerAttribute
      ? new Set(flaggedReasons.map((r) => r.attributeId)).size
      : flaggedReasons.length;
    return {
      accuracy: n > 0 ? 1 - failedUnits / n : Number.NaN,
      errorCount: flaggedReasons.length,
      accountNumerator: failedUnits,
      accountDenominator: n,
    };
  },
};
