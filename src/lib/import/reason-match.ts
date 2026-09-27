import type { LoadedConfig } from "@/lib/config/loader";
import { looseReason, normalizeReason } from "./normalize";

/** Matching a source reason to a canonical config reason (pure). */

export interface ReasonRef {
  attribute: string;
  reason: string;
}
interface IndexedReason extends ReasonRef {
  normalized: string;
  loose: string;
}

/** Persisted aliases, keyed by `${sectionCode}|${normalizedSource}`. */
export type AliasIndex = Map<string, ReasonRef>;
export const aliasKey = (sectionCode: string, source: string): string =>
  `${sectionCode}|${normalizeReason(source)}`;

/** Config error reasons grouped by section code, pre-normalised for matching. */
export function configReasonIndex(config: LoadedConfig): Map<string, IndexedReason[]> {
  const bySection = new Map<string, IndexedReason[]>();
  for (const s of config.sections) {
    const list: IndexedReason[] = [];
    for (const c of s.categories) {
      for (const a of c.attributes) {
        for (const r of a.errorReasons) {
          list.push({
            attribute: a.label,
            reason: r.label,
            normalized: normalizeReason(r.label),
            loose: looseReason(r.label),
          });
        }
      }
    }
    bySection.set(s.code, list);
  }
  return bySection;
}

/** Exact (normalised) match within a section — safe to auto-resolve. */
export function exactMatch(
  index: Map<string, IndexedReason[]>,
  sectionCode: string,
  source: string,
): ReasonRef | null {
  const n = normalizeReason(source);
  const hit = (index.get(sectionCode) ?? []).find((r) => r.normalized === n);
  return hit ? { attribute: hit.attribute, reason: hit.reason } : null;
}

/** Ranked fuzzy candidates within a section — for the admin's mapping dropdown. */
export function fuzzyCandidates(
  index: Map<string, IndexedReason[]>,
  sectionCode: string,
  source: string,
  limit = 4,
): ReasonRef[] {
  const n = normalizeReason(source);
  const l = looseReason(source);
  const scored: { ref: ReasonRef; score: number }[] = [];
  for (const r of index.get(sectionCode) ?? []) {
    let score = 0;
    if (r.normalized === n) score = 100;
    else if (r.loose === l) score = 90;
    else if (l.length >= 5 && (r.loose.startsWith(l) || l.startsWith(r.loose))) score = 70;
    else if (l.length >= 6 && (r.loose.includes(l) || l.includes(r.loose))) score = 50;
    if (score > 0) scored.push({ ref: { attribute: r.attribute, reason: r.reason }, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.ref);
}
