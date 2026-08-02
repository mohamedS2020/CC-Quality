import type { LensBasis, ScoringMode } from "@prisma/client";

/**
 * A full config "document" the editor submits to be persisted as a new
 * immutable version (task 4.2). It is id-free: order comes from array position
 * (assigned to `orderIndex`), benchmarks reference sections by `sectionCode`,
 * and dictionary entries reference severities/training buckets by label — the
 * versioning layer resolves these to ids as it writes the new version.
 */

export interface ThresholdInput {
  whenExpr: string;
  severityLabel: string | null;
  trainingBucketLabel: string | null;
}

export interface DictionaryInput {
  definition: string | null;
  severityLabel: string | null;
  trainingBucketLabel: string | null;
  thresholds: ThresholdInput[];
}

export interface ErrorReasonInput {
  label: string;
  dictionary: DictionaryInput | null;
}

export interface AttributeInput {
  label: string;
  errorReasons: ErrorReasonInput[];
}

export interface CategoryInput {
  label: string;
  attributes: AttributeInput[];
}

export interface SectionInput {
  code: string;
  label: string;
  scoringMode: ScoringMode;
  critical: boolean;
  capPerAttribute: boolean;
  rankWeight: number;
  rankBenchmark: number;
  categories: CategoryInput[];
}

export interface BenchmarkInput {
  sectionCode: string;
  threshold: number;
}

export interface LensInput {
  key: string;
  label: string;
  basis: LensBasis;
  benchmarks: BenchmarkInput[];
}

export interface ConfigInput {
  name: string;
  description?: string | null;
  roundingDecimals?: number;
  paretoCutoff?: number;
  newAgentTenureDays?: number;
  trialWindowDays?: number;
  sections: SectionInput[];
  lenses: LensInput[];
  severities: string[];
  trainingBuckets: string[];
}
