/**
 * @jest-environment node
 *
 * Config loader (FR-28/32): the DB tree is shaped into the engine-facing
 * structure with ordered sections, the derived per-section attribute count,
 * lookup indexes, and resolved dictionary labels. Uses an isolated version
 * range and leaves the active pointer untouched (configs are created inactive).
 */
import { prisma } from "@/lib/db/client";
import { loadConfigById, loadConfigByVersion } from "@/lib/config/loader";

const VERSION = 8301;
const VERSION_RANGE = { gte: 8300, lt: 8400 };

async function cleanup() {
  await prisma.scorecardConfig.deleteMany({ where: { version: VERSION_RANGE } });
}

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("config loader", () => {
  it("loads the full tree with derived counts and engine indexes", async () => {
    const config = await prisma.scorecardConfig.create({
      data: { version: VERSION, name: "Loader Test" },
    });

    const sectionA = await prisma.section.create({
      data: {
        configId: config.id,
        code: "A",
        label: "Section A",
        orderIndex: 0,
        scoringMode: "SECTION_BINARY",
        critical: true,
        rankWeight: 50,
        rankBenchmark: 0.99,
      },
    });
    const catA = await prisma.category.create({
      data: { sectionId: sectionA.id, label: "Cat A", orderIndex: 0 },
    });
    const attrA = await prisma.attribute.create({
      data: { categoryId: catA.id, label: "Attr A", orderIndex: 0 },
    });
    const reasonA = await prisma.errorReason.create({
      data: { attributeId: attrA.id, label: "Reason A", orderIndex: 0 },
    });
    const severity = await prisma.severity.create({
      data: { configId: config.id, label: "Business Critical", orderIndex: 0 },
    });
    const bucket = await prisma.trainingBucket.create({
      data: { configId: config.id, label: "Telephone etiquette", orderIndex: 0 },
    });
    await prisma.dictionaryEntry.create({
      data: {
        errorReasonId: reasonA.id,
        definition: "def",
        severityId: severity.id,
        trainingBucketId: bucket.id,
        thresholds: {
          create: [{ whenExpr: "4 <= s <= 10", orderIndex: 0, severityId: severity.id }],
        },
      },
    });

    const sectionB = await prisma.section.create({
      data: {
        configId: config.id,
        code: "B",
        label: "Section B",
        orderIndex: 1,
        scoringMode: "GRADED_ATTRIBUTES",
        critical: false,
        capPerAttribute: true,
        rankWeight: 50,
        rankBenchmark: 0.95,
      },
    });
    const catB = await prisma.category.create({
      data: { sectionId: sectionB.id, label: "Cat B", orderIndex: 0 },
    });
    for (let i = 0; i < 3; i++) {
      await prisma.attribute.create({
        data: { categoryId: catB.id, label: `Attr B${i}`, orderIndex: i },
      });
    }

    await prisma.lens.create({
      data: {
        configId: config.id,
        key: "account",
        label: "Account",
        basis: "PER_ERROR",
        orderIndex: 0,
        benchmarks: {
          create: [
            { sectionId: sectionA.id, threshold: 0.995 },
            { sectionId: sectionB.id, threshold: 0.95 },
          ],
        },
      },
    });

    const loaded = await loadConfigById(config.id);
    expect(loaded).not.toBeNull();
    if (!loaded) return;

    expect(loaded.sections.map((s) => s.code)).toEqual(["A", "B"]);
    expect(loaded.sections[1].attributeCount).toBe(3);
    expect(loaded.sections[1].capPerAttribute).toBe(true);

    const loadedReason = loaded.errorReasonById.get(reasonA.id);
    expect(loadedReason?.sectionId).toBe(sectionA.id);
    expect(loadedReason?.attributeId).toBe(attrA.id);
    expect(loadedReason?.dictionary?.severity).toBe("Business Critical");
    expect(loadedReason?.dictionary?.trainingBucket).toBe("Telephone etiquette");
    expect(loadedReason?.dictionary?.thresholds[0].whenExpr).toBe("4 <= s <= 10");

    const account = loaded.lensByKey.get("account");
    expect(account?.benchmarks.get(sectionA.id)).toBe(0.995);
    expect(account?.benchmarks.get(sectionB.id)).toBe(0.95);

    expect(loaded.severities).toContain("Business Critical");
    expect(loaded.trainingBuckets).toContain("Telephone etiquette");

    expect((await loadConfigByVersion(VERSION))?.id).toBe(config.id);
  });
});
