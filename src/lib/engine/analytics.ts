import type { LoadedAttribute, LoadedConfig } from "@/lib/config/loader";

export interface ParetoEntry {
  id: number;
  label: string;
  sectionId: number;
  count: number;
  /** This entry's share of its own section's total errors (§5.7). */
  shareInSection: number;
}

export interface ErrorAnalytics {
  totalErrors: number;
  sectionCounts: Map<number, number>;
  attributeCounts: Map<number, number>;
  reasonCounts: Map<number, number>;
  /** Training-need aggregation (§9): errors per training bucket. */
  trainingBucketCounts: Map<string, number>;
  /** Attributes ranked by error count, with share within their section. */
  attributePareto: ParetoEntry[];
  /** Error reasons ranked by frequency, with share within their section. */
  reasonPareto: ParetoEntry[];
}

function bump<K>(map: Map<K, number>, key: K): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * Error analytics (§5.7 Pareto, §9 training linkage) from the flagged reasons in
 * scope. Counts errors per reason / attribute / section and per training bucket,
 * and produces Pareto lists where share = the entry's count within its own
 * section's total. Every label and mapping comes from config — nothing hardcoded.
 */
export function computeErrorAnalytics(
  config: LoadedConfig,
  flaggedReasonIds: Iterable<number>,
): ErrorAnalytics {
  const attributeById = new Map<number, LoadedAttribute>();
  for (const section of config.sections) {
    for (const attribute of section.attributes) attributeById.set(attribute.id, attribute);
  }

  const sectionCounts = new Map<number, number>();
  const attributeCounts = new Map<number, number>();
  const reasonCounts = new Map<number, number>();
  const trainingBucketCounts = new Map<string, number>();
  let totalErrors = 0;

  for (const id of flaggedReasonIds) {
    const reason = config.errorReasonById.get(id);
    if (!reason) continue;
    totalErrors += 1;
    bump(reasonCounts, reason.id);
    bump(attributeCounts, reason.attributeId);
    bump(sectionCounts, reason.sectionId);
    const bucket = reason.dictionary?.trainingBucket;
    if (bucket) bump(trainingBucketCounts, bucket);
  }

  const shareIn = (sectionId: number, count: number): number => {
    const total = sectionCounts.get(sectionId) ?? 0;
    return total > 0 ? count / total : 0;
  };

  const attributePareto: ParetoEntry[] = [...attributeCounts.entries()]
    .map(([attributeId, count]) => {
      const attribute = attributeById.get(attributeId);
      const sectionId = attribute?.sectionId ?? -1;
      return {
        id: attributeId,
        label: attribute?.label ?? String(attributeId),
        sectionId,
        count,
        shareInSection: shareIn(sectionId, count),
      };
    })
    .sort((a, b) => b.count - a.count);

  const reasonPareto: ParetoEntry[] = [...reasonCounts.entries()]
    .map(([reasonId, count]) => {
      const reason = config.errorReasonById.get(reasonId);
      const sectionId = reason?.sectionId ?? -1;
      return {
        id: reasonId,
        label: reason?.label ?? String(reasonId),
        sectionId,
        count,
        shareInSection: shareIn(sectionId, count),
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    totalErrors,
    sectionCounts,
    attributeCounts,
    reasonCounts,
    trainingBucketCounts,
    attributePareto,
    reasonPareto,
  };
}
