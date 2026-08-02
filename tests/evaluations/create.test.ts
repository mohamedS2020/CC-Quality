/**
 * @jest-environment node
 *
 * Score-sheet save (task 6.2): the engine derives all figures from the flagged
 * reasons and persists EVALUATION + LINES stamped with the config version; only
 * enter-only fields are accepted (FR-16). Uses a self-created inactive config so
 * it never touches the active pointer or the seed.
 */
import { prisma } from "@/lib/db/client";
import { baselineConfigInput } from "@/lib/config/baseline";
import { createConfigVersion } from "@/lib/config/versioning";
import { loadConfigById, type LoadedConfig, type LoadedSection } from "@/lib/config/loader";
import { createEvaluation } from "@/lib/evaluations/create";

const AGENT_ID = 830001;
let config: LoadedConfig;
let configId: number;
let ccReason: number;
let ncReason: number;

const sectionByCode = (code: string): LoadedSection => {
  const section = config.sections.find((s) => s.code === code);
  if (!section) throw new Error(`missing section ${code}`);
  return section;
};

const base = () => ({
  qaOwner: "tester",
  callDate: new Date("2025-07-01"),
  flaggedReasonIds: [] as number[],
});

beforeAll(async () => {
  const created = await createConfigVersion(baselineConfigInput);
  configId = created.id;
  const loaded = await loadConfigById(created.id);
  if (!loaded) throw new Error("config load failed");
  config = loaded;
  ccReason = sectionByCode("CC").attributes[0].errorReasons[0].id;
  ncReason = sectionByCode("NC").attributes[0].errorReasons[0].id;

  await prisma.evaluation.deleteMany({ where: { agentLoginId: AGENT_ID } });
  await prisma.agent.deleteMany({ where: { loginId: AGENT_ID } });
  await prisma.agent.create({
    data: {
      loginId: AGENT_ID,
      agentName: "Eval Agent",
      tlName: "TL",
      joinDate: new Date("2025-01-01"),
    },
  });
});

afterAll(async () => {
  await prisma.evaluation.deleteMany({ where: { agentLoginId: AGENT_ID } });
  await prisma.agent.deleteMany({ where: { loginId: AGENT_ID } });
  await prisma.scorecardConfig.deleteMany({ where: { id: configId } });
  await prisma.$disconnect();
});

describe("createEvaluation (FR-16 derivation)", () => {
  it("derives a failed scorecard for a critical error and masks the mobile", async () => {
    const result = await createEvaluation(config, {
      ...base(),
      agentLoginId: AGENT_ID,
      mobile: "01012345678",
      flaggedReasonIds: [ccReason],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const saved = await prisma.evaluation.findUniqueOrThrow({
      where: { evalId: result.evalId },
      include: { lines: true },
    });
    expect(saved.configId).toBe(configId); // stamped with the version (FR-31)
    expect(saved.sumOfCriticals).toBe(1);
    expect(saved.failedScorecard).toBe(true);
    expect(saved.overallStatus).toBe("Fail");
    expect(saved.mobileMasked).toBe("*******5678"); // raw never stored
    expect(saved.lines).toHaveLength(1);
    expect(saved.lines[0].errorReasonId).toBe(ccReason);
  });

  it("derives a pass for a non-critical error", async () => {
    const result = await createEvaluation(config, {
      ...base(),
      agentLoginId: AGENT_ID,
      flaggedReasonIds: [ncReason],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const saved = await prisma.evaluation.findUniqueOrThrow({ where: { evalId: result.evalId } });
    expect(saved.sumOfCriticals).toBe(0);
    expect(saved.failedScorecard).toBe(false);
    expect(saved.overallStatus).toBe("Pass");
  });

  it("rejects an error reason not in the config", async () => {
    const result = await createEvaluation(config, {
      ...base(),
      agentLoginId: AGENT_ID,
      flaggedReasonIds: [999_000_001],
    });
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects an unknown agent", async () => {
    const result = await createEvaluation(config, {
      ...base(),
      agentLoginId: 839999,
      flaggedReasonIds: [ncReason],
    });
    expect(result).toMatchObject({ ok: false });
  });
});
