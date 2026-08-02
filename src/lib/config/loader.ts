import type { LensBasis, ScoringMode } from "@prisma/client";
import { configRepository, type RawFullConfig } from "@/lib/db/repositories/configRepository";

/**
 * The config loader (FR-28): reads a full config version from the DB and shapes
 * it into a typed, engine-friendly structure — the ordered section/rubric tree
 * plus lookup indexes (error reason -> section, lens -> benchmarks) and the
 * DERIVED per-section attribute count (the NC denominator, FR-32).
 *
 * The scoring engine (task 5) loads the config version STAMPED on an evaluation
 * so historical figures stay reproducible; live views load the active version.
 */

export interface LoadedThreshold {
  whenExpr: string;
  severity: string | null;
  trainingBucket: string | null;
  orderIndex: number;
}

export interface LoadedDictionaryEntry {
  id: number;
  errorReasonId: number;
  definition: string | null;
  severity: string | null;
  trainingBucket: string | null;
  thresholds: LoadedThreshold[];
}

export interface LoadedErrorReason {
  id: number;
  label: string;
  orderIndex: number;
  attributeId: number;
  sectionId: number; // denormalized so scoring resolves reason -> section in O(1)
  dictionary: LoadedDictionaryEntry | null;
}

export interface LoadedAttribute {
  id: number;
  label: string;
  orderIndex: number;
  categoryId: number;
  sectionId: number;
  errorReasons: LoadedErrorReason[];
}

export interface LoadedCategory {
  id: number;
  label: string;
  orderIndex: number;
  sectionId: number;
  attributes: LoadedAttribute[];
}

export interface LoadedSection {
  id: number;
  code: string;
  label: string;
  orderIndex: number;
  scoringMode: ScoringMode;
  critical: boolean;
  capPerAttribute: boolean;
  rankWeight: number;
  rankBenchmark: number;
  categories: LoadedCategory[];
  attributes: LoadedAttribute[]; // flattened, in category then attribute order
  attributeCount: number; // DERIVED: count(attributes) — the graded denominator (FR-32)
}

export interface LoadedLens {
  id: number;
  key: string;
  label: string;
  basis: LensBasis;
  orderIndex: number;
  benchmarks: Map<number, number>; // sectionId -> threshold
}

export interface LoadedConfig {
  id: number;
  version: number;
  name: string;
  isActive: boolean;
  roundingDecimals: number;
  paretoCutoff: number;
  newAgentTenureDays: number;
  trialWindowDays: number;
  sections: LoadedSection[];
  lenses: LoadedLens[];
  severities: string[];
  trainingBuckets: string[];

  // Indexes for the engine (server-side use; not serialized to the client).
  sectionById: Map<number, LoadedSection>;
  errorReasonById: Map<number, LoadedErrorReason>;
  lensByKey: Map<string, LoadedLens>;
}

function toLoadedDictionaryEntry(
  entry: NonNullable<
    RawFullConfig["sections"][number]["categories"][number]["attributes"][number]["errorReasons"][number]["dictionaryEntry"]
  >,
): LoadedDictionaryEntry {
  return {
    id: entry.id,
    errorReasonId: entry.errorReasonId,
    definition: entry.definition,
    severity: entry.severity?.label ?? null,
    trainingBucket: entry.trainingBucket?.label ?? null,
    thresholds: entry.thresholds.map((t) => ({
      whenExpr: t.whenExpr,
      severity: t.severity?.label ?? null,
      trainingBucket: t.trainingBucket?.label ?? null,
      orderIndex: t.orderIndex,
    })),
  };
}

function toLoadedConfig(raw: RawFullConfig): LoadedConfig {
  const sections: LoadedSection[] = raw.sections.map((section) => {
    const categories: LoadedCategory[] = section.categories.map((category) => ({
      id: category.id,
      label: category.label,
      orderIndex: category.orderIndex,
      sectionId: section.id,
      attributes: category.attributes.map((attribute) => ({
        id: attribute.id,
        label: attribute.label,
        orderIndex: attribute.orderIndex,
        categoryId: category.id,
        sectionId: section.id,
        errorReasons: attribute.errorReasons.map((reason) => ({
          id: reason.id,
          label: reason.label,
          orderIndex: reason.orderIndex,
          attributeId: attribute.id,
          sectionId: section.id,
          dictionary: reason.dictionaryEntry
            ? toLoadedDictionaryEntry(reason.dictionaryEntry)
            : null,
        })),
      })),
    }));

    const attributes = categories.flatMap((category) => category.attributes);

    return {
      id: section.id,
      code: section.code,
      label: section.label,
      orderIndex: section.orderIndex,
      scoringMode: section.scoringMode,
      critical: section.critical,
      capPerAttribute: section.capPerAttribute,
      rankWeight: section.rankWeight,
      rankBenchmark: section.rankBenchmark,
      categories,
      attributes,
      attributeCount: attributes.length,
    };
  });

  const lenses: LoadedLens[] = raw.lenses.map((lens) => ({
    id: lens.id,
    key: lens.key,
    label: lens.label,
    basis: lens.basis,
    orderIndex: lens.orderIndex,
    benchmarks: new Map(lens.benchmarks.map((b) => [b.sectionId, b.threshold])),
  }));

  const errorReasonById = new Map<number, LoadedErrorReason>();
  for (const section of sections) {
    for (const attribute of section.attributes) {
      for (const reason of attribute.errorReasons) {
        errorReasonById.set(reason.id, reason);
      }
    }
  }

  return {
    id: raw.id,
    version: raw.version,
    name: raw.name,
    isActive: raw.isActive,
    roundingDecimals: raw.roundingDecimals,
    paretoCutoff: raw.paretoCutoff,
    newAgentTenureDays: raw.newAgentTenureDays,
    trialWindowDays: raw.trialWindowDays,
    sections,
    lenses,
    severities: raw.severities.map((s) => s.label),
    trainingBuckets: raw.trainingBuckets.map((t) => t.label),
    sectionById: new Map(sections.map((s) => [s.id, s])),
    errorReasonById,
    lensByKey: new Map(lenses.map((l) => [l.key, l])),
  };
}

export async function loadConfigById(id: number): Promise<LoadedConfig | null> {
  const raw = await configRepository.findByIdRaw(id);
  return raw ? toLoadedConfig(raw) : null;
}

export async function loadConfigByVersion(version: number): Promise<LoadedConfig | null> {
  const raw = await configRepository.findByVersionRaw(version);
  return raw ? toLoadedConfig(raw) : null;
}

export async function loadActiveConfig(): Promise<LoadedConfig | null> {
  const raw = await configRepository.findActiveRaw();
  return raw ? toLoadedConfig(raw) : null;
}
