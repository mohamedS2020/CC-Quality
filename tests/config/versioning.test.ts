/**
 * @jest-environment node
 *
 * Config versioning (FR-30) and history pinning (FR-31): saving creates a new
 * immutable version with a single active pointer, older versions stay intact,
 * and an evaluation stamped with a version is unaffected when the active config
 * later changes.
 *
 * This is the only test file that touches the global active-config pointer, so
 * it captures the pre-test active version and restores it afterwards (leaving
 * the seeded baseline active).
 */
import { prisma } from "@/lib/db/client";
import type { ConfigInput } from "@/lib/config/input";
import {
  activateConfigVersion,
  buildInputFromLoaded,
  createConfigVersion,
} from "@/lib/config/versioning";
import { loadConfigById, loadConfigByVersion } from "@/lib/config/loader";

const AGENT_ID = 820001;
const createdConfigIds: number[] = [];
let previousActiveId: number | null = null;

function sampleInput(name: string): ConfigInput {
  return {
    name,
    severities: ["Business Critical"],
    trainingBuckets: ["Telephone etiquette"],
    sections: [
      {
        code: "CC",
        label: "Call Control",
        scoringMode: "SECTION_BINARY",
        critical: true,
        capPerAttribute: false,
        rankWeight: 60,
        rankBenchmark: 0.99,
        categories: [
          {
            label: "Cat",
            attributes: [
              {
                label: "Attr1",
                errorReasons: [
                  {
                    label: "Reason1",
                    dictionary: {
                      definition: "d",
                      severityLabel: "Business Critical",
                      trainingBucketLabel: "Telephone etiquette",
                      thresholds: [],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        code: "NC",
        label: "Non Critical",
        scoringMode: "GRADED_ATTRIBUTES",
        critical: false,
        capPerAttribute: false,
        rankWeight: 40,
        rankBenchmark: 0.95,
        categories: [
          {
            label: "CatN",
            attributes: [
              { label: "A1", errorReasons: [] },
              { label: "A2", errorReasons: [] },
            ],
          },
        ],
      },
    ],
    lenses: [
      {
        key: "account",
        label: "Account",
        basis: "PER_ERROR",
        benchmarks: [
          { sectionCode: "CC", threshold: 0.995 },
          { sectionCode: "NC", threshold: 0.95 },
        ],
      },
    ],
  };
}

beforeAll(async () => {
  const active = await prisma.scorecardConfig.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  previousActiveId = active?.id ?? null;
  await prisma.evaluation.deleteMany({ where: { agentLoginId: AGENT_ID } });
  await prisma.agent.deleteMany({ where: { loginId: AGENT_ID } });
});

afterAll(async () => {
  await prisma.evaluation.deleteMany({ where: { agentLoginId: AGENT_ID } });
  await prisma.agent.deleteMany({ where: { loginId: AGENT_ID } });
  if (createdConfigIds.length) {
    await prisma.scorecardConfig.deleteMany({ where: { id: { in: createdConfigIds } } });
  }
  // Restore the previously-active config (the seeded baseline).
  if (previousActiveId !== null) {
    await prisma.scorecardConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    await prisma.scorecardConfig.update({
      where: { id: previousActiveId },
      data: { isActive: true },
    });
  }
  await prisma.$disconnect();
});

describe("config versioning (FR-30)", () => {
  it("creates monotonically increasing immutable versions with a single active pointer", async () => {
    const v1 = await createConfigVersion(sampleInput("v1"), { activate: true });
    createdConfigIds.push(v1.id);
    const v2 = await createConfigVersion(sampleInput("v2"), { activate: true });
    createdConfigIds.push(v2.id);

    // Monotonic increasing (not necessarily consecutive: parallel test files
    // create their own config versions between these two calls).
    expect(v2.version).toBeGreaterThan(v1.version);
    expect((await prisma.scorecardConfig.findUnique({ where: { id: v2.id } }))?.isActive).toBe(
      true,
    );
    expect((await prisma.scorecardConfig.findUnique({ where: { id: v1.id } }))?.isActive).toBe(
      false,
    );

    // v1 stays intact and loadable by its version.
    const loadedV1 = await loadConfigByVersion(v1.version);
    expect(loadedV1?.name).toBe("v1");
    expect(loadedV1?.sections.map((s) => s.code)).toEqual(["CC", "NC"]);
    expect(loadedV1?.sections[1].attributeCount).toBe(2);
  });

  it("re-activating an older version flips the pointer", async () => {
    const v1 = await createConfigVersion(sampleInput("react-1"), { activate: true });
    createdConfigIds.push(v1.id);
    const v2 = await createConfigVersion(sampleInput("react-2"), { activate: true });
    createdConfigIds.push(v2.id);

    await activateConfigVersion(v1.id);
    expect((await prisma.scorecardConfig.findUnique({ where: { id: v1.id } }))?.isActive).toBe(
      true,
    );
    expect((await prisma.scorecardConfig.findUnique({ where: { id: v2.id } }))?.isActive).toBe(
      false,
    );
  });

  it("round-trips a loaded version into a new version via buildInputFromLoaded", async () => {
    const v1 = await createConfigVersion(sampleInput("roundtrip"));
    createdConfigIds.push(v1.id);
    const loaded = await loadConfigById(v1.id);
    expect(loaded).not.toBeNull();
    if (!loaded) return;

    const clone = await createConfigVersion(buildInputFromLoaded(loaded));
    createdConfigIds.push(clone.id);
    const loadedClone = await loadConfigById(clone.id);

    expect(loadedClone?.sections.map((s) => s.code)).toEqual(loaded.sections.map((s) => s.code));
    expect(loadedClone?.lenses[0].benchmarks.get(loadedClone.sections[0].id)).toBe(0.995);
    const reason = [...(loadedClone?.errorReasonById.values() ?? [])].find((r) => r.dictionary);
    expect(reason?.dictionary?.severity).toBe("Business Critical");
  });
});

describe("history pinning (FR-31)", () => {
  it("keeps an evaluation pinned to its config version when the active config changes", async () => {
    const versionA = await createConfigVersion(sampleInput("pin-A"), { activate: true });
    createdConfigIds.push(versionA.id);

    await prisma.agent.create({
      data: { loginId: AGENT_ID, agentName: "Pin Agent", tlName: "TL", joinDate: new Date() },
    });
    const evaluation = await prisma.evaluation.create({
      data: {
        agentLoginId: AGENT_ID,
        configId: versionA.id,
        qaOwner: "qa",
        callDate: new Date(),
      },
    });

    // The active config moves on to a different version B.
    const versionB = await createConfigVersion(sampleInput("pin-B"), { activate: true });
    createdConfigIds.push(versionB.id);

    // The evaluation still points at A, and A's tree is unchanged.
    const reloaded = await prisma.evaluation.findUnique({ where: { evalId: evaluation.evalId } });
    expect(reloaded?.configId).toBe(versionA.id);

    const loadedA = await loadConfigById(versionA.id);
    expect(loadedA?.name).toBe("pin-A");
    expect(
      (await prisma.scorecardConfig.findUnique({ where: { id: versionB.id } }))?.isActive,
    ).toBe(true);
  });
});
