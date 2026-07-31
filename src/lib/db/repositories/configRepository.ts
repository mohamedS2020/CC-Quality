import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

/**
 * Deep include that pulls a full config version in one query: sections -> the
 * rubric tree (categories -> attributes -> error reasons, each with its
 * dictionary entry + threshold rules), plus lenses -> benchmarks and the
 * severity/training-bucket reference lists. Everything is ordered by
 * `orderIndex` so the loaded shape is deterministic.
 */
export const fullConfigInclude = {
  sections: {
    orderBy: { orderIndex: "asc" },
    include: {
      categories: {
        orderBy: { orderIndex: "asc" },
        include: {
          attributes: {
            orderBy: { orderIndex: "asc" },
            include: {
              errorReasons: {
                orderBy: { orderIndex: "asc" },
                include: {
                  dictionaryEntry: {
                    include: {
                      severity: true,
                      trainingBucket: true,
                      thresholds: {
                        orderBy: { orderIndex: "asc" },
                        include: { severity: true, trainingBucket: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  lenses: { orderBy: { orderIndex: "asc" }, include: { benchmarks: true } },
  severities: { orderBy: { orderIndex: "asc" } },
  trainingBuckets: { orderBy: { orderIndex: "asc" } },
} satisfies Prisma.ScorecardConfigInclude;

export type RawFullConfig = Prisma.ScorecardConfigGetPayload<{
  include: typeof fullConfigInclude;
}>;

/** Read-side data access for whole config versions (backs the config loader). */
export const configRepository = {
  findActiveRaw(): Promise<RawFullConfig | null> {
    return prisma.scorecardConfig.findFirst({
      where: { isActive: true },
      include: fullConfigInclude,
    });
  },

  findByIdRaw(id: number): Promise<RawFullConfig | null> {
    return prisma.scorecardConfig.findUnique({ where: { id }, include: fullConfigInclude });
  },

  findByVersionRaw(version: number): Promise<RawFullConfig | null> {
    return prisma.scorecardConfig.findUnique({ where: { version }, include: fullConfigInclude });
  },
};
