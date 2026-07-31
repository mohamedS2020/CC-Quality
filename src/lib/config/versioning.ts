import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import type { ConfigInput } from "./input";
import type { LoadedConfig } from "./loader";
import { ConfigValidationError, validateConfigInput } from "./validation";

/**
 * Config versioning (FR-30). Saving never mutates an existing version: it
 * materializes the whole submitted document as a NEW immutable version, so
 * evaluations pinned to an older version stay reproducible (FR-31). Exactly one
 * version is active at a time — that pointer is the "current" config.
 */

function labelToId(map: Map<string, number>, label: string | null | undefined): number | null {
  if (label == null) return null;
  const id = map.get(label);
  if (id === undefined) throw new Error(`Config references unknown label "${label}".`);
  return id;
}

function requireSectionId(map: Map<string, number>, code: string): number {
  const id = map.get(code);
  if (id === undefined) throw new Error(`Benchmark references unknown section code "${code}".`);
  return id;
}

export interface CreatedConfigVersion {
  id: number;
  version: number;
}

const MAX_SAVE_ATTEMPTS = 8;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retryable transient failures when saving config: a unique-constraint clash on
 * the `version` column (two saves picked the same next number), and Postgres
 * write-conflict / deadlock (P2034) under concurrent activation. Both are safe
 * to retry — the whole transaction rolled back.
 */
function isRetryableSaveError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  if (error.code === "P2002") {
    const target = error.meta?.target;
    const fields = Array.isArray(target) ? target : target == null ? [] : [target];
    return fields.some((f) => String(f).includes("version"));
  }
  return false;
}

/** Run a save transaction, retrying transient version/deadlock conflicts with backoff. */
async function withSaveRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_SAVE_ATTEMPTS; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt < MAX_SAVE_ATTEMPTS && isRetryableSaveError(error)) {
        await sleep(10 * attempt);
        continue;
      }
      throw error;
    }
  }
  throw new Error("config save: exhausted retries");
}

/**
 * Persist `input` as a new config version. Version numbers increase
 * monotonically (max + 1); a concurrent double-save that picks the same number
 * loses the unique constraint and is retried. Pass `activate` to make the new
 * version the active one atomically.
 */
export async function createConfigVersion(
  input: ConfigInput,
  options: { createdById?: number; activate?: boolean } = {},
): Promise<CreatedConfigVersion> {
  // Block save on any guardrail violation (FR-29) before touching the DB.
  const validation = validateConfigInput(input);
  if (!validation.ok) throw new ConfigValidationError(validation.errors);

  return withSaveRetry(() =>
    prisma.$transaction(async (tx) => {
      const { _max } = await tx.scorecardConfig.aggregate({ _max: { version: true } });
      const version = (_max.version ?? 0) + 1;

      const config = await tx.scorecardConfig.create({
        data: {
          version,
          name: input.name,
          description: input.description ?? null,
          roundingDecimals: input.roundingDecimals ?? 2,
          paretoCutoff: input.paretoCutoff ?? 0.8,
          createdById: options.createdById ?? null,
        },
      });

      const severityId = new Map<string, number>();
      for (const [i, label] of input.severities.entries()) {
        const row = await tx.severity.create({
          data: { configId: config.id, label, orderIndex: i },
        });
        severityId.set(label, row.id);
      }

      const bucketId = new Map<string, number>();
      for (const [i, label] of input.trainingBuckets.entries()) {
        const row = await tx.trainingBucket.create({
          data: { configId: config.id, label, orderIndex: i },
        });
        bucketId.set(label, row.id);
      }

      const sectionIdByCode = new Map<string, number>();
      for (const [si, section] of input.sections.entries()) {
        const created = await tx.section.create({
          data: {
            configId: config.id,
            code: section.code,
            label: section.label,
            orderIndex: si,
            scoringMode: section.scoringMode,
            critical: section.critical,
            capPerAttribute: section.capPerAttribute,
            rankWeight: section.rankWeight,
            rankBenchmark: section.rankBenchmark,
            categories: {
              create: section.categories.map((category, ci) => ({
                label: category.label,
                orderIndex: ci,
                attributes: {
                  create: category.attributes.map((attribute, ai) => ({
                    label: attribute.label,
                    orderIndex: ai,
                    errorReasons: {
                      create: attribute.errorReasons.map((reason, ri) => ({
                        label: reason.label,
                        orderIndex: ri,
                        dictionaryEntry: reason.dictionary
                          ? {
                              create: {
                                definition: reason.dictionary.definition ?? null,
                                severityId: labelToId(severityId, reason.dictionary.severityLabel),
                                trainingBucketId: labelToId(
                                  bucketId,
                                  reason.dictionary.trainingBucketLabel,
                                ),
                                thresholds: {
                                  create: reason.dictionary.thresholds.map((t, ti) => ({
                                    whenExpr: t.whenExpr,
                                    orderIndex: ti,
                                    severityId: labelToId(severityId, t.severityLabel),
                                    trainingBucketId: labelToId(bucketId, t.trainingBucketLabel),
                                  })),
                                },
                              },
                            }
                          : undefined,
                      })),
                    },
                  })),
                },
              })),
            },
          },
        });
        sectionIdByCode.set(section.code, created.id);
      }

      for (const [li, lens] of input.lenses.entries()) {
        await tx.lens.create({
          data: {
            configId: config.id,
            key: lens.key,
            label: lens.label,
            basis: lens.basis,
            orderIndex: li,
            benchmarks: {
              create: lens.benchmarks.map((b) => ({
                sectionId: requireSectionId(sectionIdByCode, b.sectionCode),
                threshold: b.threshold,
              })),
            },
          },
        });
      }

      if (options.activate) {
        await tx.scorecardConfig.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
        await tx.scorecardConfig.update({ where: { id: config.id }, data: { isActive: true } });
      }

      return { id: config.id, version };
    }),
  );
}

/** Make `id` the single active version (clears any previous active pointer). */
export async function activateConfigVersion(id: number): Promise<void> {
  await withSaveRetry(() =>
    prisma.$transaction([
      prisma.scorecardConfig.updateMany({ where: { isActive: true }, data: { isActive: false } }),
      prisma.scorecardConfig.update({ where: { id }, data: { isActive: true } }),
    ]),
  );
}

/**
 * Turn a loaded version back into an editable input document — the basis for
 * "edit the current config and save as a new version" and for cloning.
 */
export function buildInputFromLoaded(loaded: LoadedConfig): ConfigInput {
  return {
    name: loaded.name,
    description: null,
    roundingDecimals: loaded.roundingDecimals,
    paretoCutoff: loaded.paretoCutoff,
    severities: [...loaded.severities],
    trainingBuckets: [...loaded.trainingBuckets],
    sections: loaded.sections.map((section) => ({
      code: section.code,
      label: section.label,
      scoringMode: section.scoringMode,
      critical: section.critical,
      capPerAttribute: section.capPerAttribute,
      rankWeight: section.rankWeight,
      rankBenchmark: section.rankBenchmark,
      categories: section.categories.map((category) => ({
        label: category.label,
        attributes: category.attributes.map((attribute) => ({
          label: attribute.label,
          errorReasons: attribute.errorReasons.map((reason) => ({
            label: reason.label,
            dictionary: reason.dictionary
              ? {
                  definition: reason.dictionary.definition,
                  severityLabel: reason.dictionary.severity,
                  trainingBucketLabel: reason.dictionary.trainingBucket,
                  thresholds: reason.dictionary.thresholds.map((t) => ({
                    whenExpr: t.whenExpr,
                    severityLabel: t.severity,
                    trainingBucketLabel: t.trainingBucket,
                  })),
                }
              : null,
          })),
        })),
      })),
    })),
    lenses: loaded.lenses.map((lens) => ({
      key: lens.key,
      label: lens.label,
      basis: lens.basis,
      benchmarks: [...lens.benchmarks.entries()].flatMap(([sectionId, threshold]) => {
        const section = loaded.sectionById.get(sectionId);
        return section ? [{ sectionCode: section.code, threshold }] : [];
      }),
    })),
  };
}
