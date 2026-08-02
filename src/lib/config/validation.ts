import type { ConfigInput, DictionaryInput } from "./input";

/**
 * Config guardrails (FR-29). A pure, exhaustive validator: it collects every
 * violation (rather than throwing on the first) so the editor can surface them
 * all, and the save path blocks persistence unless the result is ok. Kept free
 * of DB/server-only so it runs identically in the browser and on the server.
 */

export interface ValidationError {
  path: string;
  message: string;
}

export type ValidationResult = { ok: true } | { ok: false; errors: ValidationError[] };

/** Thrown by the save path when a config fails validation, so callers can 400. */
export class ConfigValidationError extends Error {
  constructor(public readonly errors: ValidationError[]) {
    super(`Config validation failed with ${errors.length} error(s).`);
    this.name = "ConfigValidationError";
  }
}

const RANK_WEIGHT_TOTAL = 100;
const EPSILON = 1e-6;

type AddError = (path: string, message: string) => void;

function inRange01(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function duplicates(labels: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const label of labels) {
    if (seen.has(label)) dups.add(label);
    seen.add(label);
  }
  return [...dups];
}

function validateDictionary(
  dictionary: DictionaryInput,
  path: string,
  severities: Set<string>,
  buckets: Set<string>,
  add: AddError,
): void {
  if (dictionary.severityLabel != null && !severities.has(dictionary.severityLabel)) {
    add(`${path}.severity`, `Unknown severity "${dictionary.severityLabel}".`);
  }
  if (dictionary.trainingBucketLabel != null && !buckets.has(dictionary.trainingBucketLabel)) {
    add(`${path}.trainingBucket`, `Unknown training bucket "${dictionary.trainingBucketLabel}".`);
  }
  dictionary.thresholds.forEach((t, ti) => {
    const tp = `${path}.thresholds[${ti}]`;
    if (!t.whenExpr.trim()) add(`${tp}.whenExpr`, "Threshold condition is required.");
    if (t.severityLabel != null && !severities.has(t.severityLabel)) {
      add(`${tp}.severity`, `Unknown severity "${t.severityLabel}".`);
    }
    if (t.trainingBucketLabel != null && !buckets.has(t.trainingBucketLabel)) {
      add(`${tp}.trainingBucket`, `Unknown training bucket "${t.trainingBucketLabel}".`);
    }
  });
}

export function validateConfigInput(input: ConfigInput): ValidationResult {
  const errors: ValidationError[] = [];
  const add: AddError = (path, message) => errors.push({ path, message });

  // --- Config-level ---
  if (!input.name.trim()) add("name", "Config name is required.");
  if (
    input.roundingDecimals != null &&
    (!Number.isInteger(input.roundingDecimals) || input.roundingDecimals < 0)
  ) {
    add("roundingDecimals", "Rounding decimals must be a non-negative integer.");
  }
  if (input.paretoCutoff != null && !inRange01(input.paretoCutoff)) {
    add("paretoCutoff", "Pareto cutoff must be between 0 and 1.");
  }
  if (
    input.newAgentTenureDays != null &&
    (!Number.isInteger(input.newAgentTenureDays) || input.newAgentTenureDays < 0)
  ) {
    add("newAgentTenureDays", "New-agent tenure threshold must be a non-negative integer of days.");
  }
  if (
    input.trialWindowDays != null &&
    (!Number.isInteger(input.trialWindowDays) || input.trialWindowDays < 0)
  ) {
    add("trialWindowDays", "Trial window must be a non-negative integer of days.");
  }
  if (input.sections.length === 0) add("sections", "At least one section is required.");

  // --- Reference lists ---
  const severities = new Set(input.severities);
  const buckets = new Set(input.trainingBuckets);
  for (const dup of duplicates(input.severities)) add("severities", `Duplicate severity "${dup}".`);
  for (const dup of duplicates(input.trainingBuckets)) {
    add("trainingBuckets", `Duplicate training bucket "${dup}".`);
  }

  // --- Sections + rubric tree ---
  const sectionCodes = input.sections.map((s) => s.code);
  for (const dup of duplicates(sectionCodes)) add("sections", `Duplicate section code "${dup}".`);

  let rankWeightSum = 0;
  input.sections.forEach((section, si) => {
    const p = `sections[${si}]`;
    if (!section.code.trim()) add(`${p}.code`, "Section code is required.");
    if (!section.label.trim()) add(`${p}.label`, "Section label is required.");
    if (!Number.isFinite(section.rankWeight) || section.rankWeight < 0) {
      add(`${p}.rankWeight`, "Rank weight must be a number ≥ 0.");
    } else {
      rankWeightSum += section.rankWeight;
    }
    if (!inRange01(section.rankBenchmark)) {
      add(`${p}.rankBenchmark`, "Rank benchmark must be between 0 and 1.");
    }

    for (const dup of duplicates(section.categories.map((c) => c.label))) {
      add(`${p}.categories`, `Duplicate category "${dup}".`);
    }

    const attributeLabels: string[] = [];
    section.categories.forEach((category, ci) => {
      const cp = `${p}.categories[${ci}]`;
      if (!category.label.trim()) add(`${cp}.label`, "Category label is required.");
      category.attributes.forEach((attribute, ai) => {
        const ap = `${cp}.attributes[${ai}]`;
        if (!attribute.label.trim()) add(`${ap}.label`, "Attribute label is required.");
        attributeLabels.push(attribute.label);

        for (const dup of duplicates(attribute.errorReasons.map((r) => r.label))) {
          add(`${ap}.errorReasons`, `Duplicate error reason "${dup}" within attribute.`);
        }
        attribute.errorReasons.forEach((reason, ri) => {
          const rp = `${ap}.errorReasons[${ri}]`;
          if (!reason.label.trim()) add(`${rp}.label`, "Error reason label is required.");
          if (reason.dictionary) {
            validateDictionary(reason.dictionary, `${rp}.dictionary`, severities, buckets, add);
          }
        });
      });
    });

    // No duplicate attribute names within a section (FR-29).
    for (const dup of duplicates(attributeLabels)) {
      add(p, `Duplicate attribute name "${dup}" within section.`);
    }
    // A graded section needs a non-zero denominator.
    if (section.scoringMode === "GRADED_ATTRIBUTES" && attributeLabels.length === 0) {
      add(p, "A graded section must have at least one attribute (denominator > 0).");
    }
  });

  // Rank weights must sum to 100%.
  if (input.sections.length > 0 && Math.abs(rankWeightSum - RANK_WEIGHT_TOTAL) > EPSILON) {
    add("sections", `Rank weights must sum to ${RANK_WEIGHT_TOTAL} (got ${rankWeightSum}).`);
  }

  // --- Lenses + benchmarks ---
  const validSectionCodes = new Set(sectionCodes);
  for (const dup of duplicates(input.lenses.map((l) => l.key))) {
    add("lenses", `Duplicate lens key "${dup}".`);
  }
  input.lenses.forEach((lens, li) => {
    const lp = `lenses[${li}]`;
    if (!lens.key.trim()) add(`${lp}.key`, "Lens key is required.");
    if (!lens.label.trim()) add(`${lp}.label`, "Lens label is required.");

    const benchmarkCodes = lens.benchmarks.map((b) => b.sectionCode);
    for (const dup of duplicates(benchmarkCodes)) {
      add(`${lp}.benchmarks`, `Duplicate benchmark for section "${dup}".`);
    }
    lens.benchmarks.forEach((b, bi) => {
      if (!validSectionCodes.has(b.sectionCode)) {
        add(`${lp}.benchmarks[${bi}]`, `Benchmark references unknown section "${b.sectionCode}".`);
      }
      if (!inRange01(b.threshold)) {
        add(`${lp}.benchmarks[${bi}].threshold`, "Benchmark must be between 0 and 1.");
      }
    });
    // Every lens must define a benchmark for every section.
    const covered = new Set(benchmarkCodes);
    for (const code of validSectionCodes) {
      if (!covered.has(code)) add(`${lp}.benchmarks`, `Missing benchmark for section "${code}".`);
    }
  });

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
