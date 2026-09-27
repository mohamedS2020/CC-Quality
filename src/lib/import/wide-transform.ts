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
}

/** Deterministic id from stable call fields, so re-importing a file dedupes. */
function evalIdFor(meta: Record<string, string>): string {
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

  for (const call of calls) {
    const base = { eval_id: evalIdFor(call.meta), ...call.meta };

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

  return { rows, unmapped: [...unmappedMap.values()], callCount: calls.length, flagCount };
}
