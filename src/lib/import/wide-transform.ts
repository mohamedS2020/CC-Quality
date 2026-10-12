import { createHash } from "node:crypto";
import type { LoadedConfig } from "@/lib/config/loader";
import {
  aliasKey,
  configReasonIndex,
  exactMatch,
  fuzzyCandidates,
  type AliasIndex,
  type ReasonRef,
} from "./reason-match";
import type { WideCall } from "./wide";

/**
 * Turn parsed wide calls into the long-format records the existing importer
 * consumes, resolving each source reason via (1) a saved alias, then (2) an
 * exact config match. Anything still unresolved is reported as `unmapped` so the
 * admin can map it once (which saves an alias). Import must not proceed while any
 * reason is unmapped, since a call would otherwise be under-flagged.
 */

export interface UnmappedReason {
  sectionCode: string;
  sample: string;
  count: number;
  suggestions: ReasonRef[];
}

export interface WideTransform {
  rows: Record<string, string>[];
  unmapped: UnmappedReason[];
  callCount: number;
  flagCount: number;
  /** Calls whose identifying fields repeat an earlier row (kept, not merged). */
  repeatedBasis: number;
}

/**
 * Deterministic id from stable call fields, so re-importing a file dedupes.
 *
 * These fields do NOT uniquely identify a call: the same agent can handle the
 * same number twice on the same day with the same call type, and `call_id` is
 * optional in the wide sheet. Rows that share a basis therefore get a stable
 * occurrence suffix (`-2`, `-3`, …) instead of collapsing into one evaluation —
 * silently merging them would under-count calls and merge their flags. The
 * first occurrence keeps the bare hash, so ids already imported stay matched.
 */
function evalBasisFor(meta: Record<string, string>): string {
  const basis = [
    meta.login_id,
    meta.call_date,
    meta.mobile,
    meta.call_type,
    meta.monitoring_type,
    meta.call_id ?? "",
  ].join("|");
  return `w-${createHash("sha256").update(basis).digest("hex").slice(0, 16)}`;
}

export function transformWide(
  config: LoadedConfig,
  calls: WideCall[],
  aliases: AliasIndex,
): WideTransform {
  const index = configReasonIndex(config);
  const unmappedMap = new Map<string, UnmappedReason>();
  const rows: Record<string, string>[] = [];
  let flagCount = 0;
  const seenBasis = new Map<string, number>();
  let mergedRows = 0;

  for (const call of calls) {
    const basis = evalBasisFor(call.meta);
    const seen = (seenBasis.get(basis) ?? 0) + 1;
    seenBasis.set(basis, seen);
    if (seen > 1) mergedRows += 1;
    // `__row` is the SHEET row so an error names what the user sees in Excel:
    // rowNumber is the 1-based data row, and the header occupies row 1.
    const base = {
      eval_id: seen === 1 ? basis : `${basis}-${seen}`,
      __row: String(call.rowNumber + 1),
      ...call.meta,
    };

    if (call.flags.length === 0) {
      rows.push({ ...base }); // clean call — a single blank-error row
      continue;
    }

    for (const flag of call.flags) {
      flagCount += 1;
      const ref =
        aliases.get(aliasKey(flag.sectionCode, flag.source)) ??
        exactMatch(index, flag.sectionCode, flag.source);
      if (ref) {
        rows.push({
          ...base,
          section_code: flag.sectionCode,
          attribute: ref.attribute,
          error_reason: ref.reason,
        });
      } else {
        const key = aliasKey(flag.sectionCode, flag.source);
        const existing = unmappedMap.get(key);
        if (existing) existing.count += 1;
        else {
          unmappedMap.set(key, {
            sectionCode: flag.sectionCode,
            sample: flag.source.trim(),
            count: 1,
            suggestions: fuzzyCandidates(index, flag.sectionCode, flag.source),
          });
        }
      }
    }
  }

  return {
    rows,
    unmapped: [...unmappedMap.values()],
    callCount: calls.length,
    flagCount,
    repeatedBasis: mergedRows,
  };
}
