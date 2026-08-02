/**
 * @jest-environment node
 *
 * Versioned corrections (task 6.8): a correction never mutates a scored row — it
 * supersedes it and writes a NEW version linked back to it, carrying who/when/why
 * (FR-14/15). Re-scoring uses the original's config version. A locked period
 * blocks corrections (FR-44). Uses a self-created inactive config + far-future
 * months so it never touches the active pointer or other suites' periods.
 */
import { prisma } from "@/lib/db/client";
import { baselineConfigInput } from "@/lib/config/baseline";
import { createConfigVersion } from "@/lib/config/versioning";
import { loadConfigById, type LoadedConfig, type LoadedSection } from "@/lib/config/loader";
import { createEvaluation } from "@/lib/evaluations/create";
import { correctEvaluation } from "@/lib/evaluations/correct";
import { getEvaluationHistory, listCurrentEvaluations } from "@/lib/evaluations/query";
import { resolveMonthlyPeriod, transitionPeriod } from "@/lib/periods/period";

const AGENT_ID = 870001;
const USER_EMAIL = "correct-test@example.com";
const CALL_DATE = new Date("2098-05-15T00:00:00Z");
const LOCK_CALL_DATE = new Date("2098-06-15T00:00:00Z");

let config: LoadedConfig;
let configId: number;
let userId: number;
let ccReason: number;
let ncReason: number;

const sectionByCode = (code: string): LoadedSection => {
  const section = config.sections.find((s) => s.code === code);
  if (!section) throw new Error(`missing section ${code}`);
  return section;
};

async function cleanup() {
  await prisma.evaluation.deleteMany({ where: { agentLoginId: AGENT_ID } });
  await prisma.period.deleteMany({
    where: { type: "MONTH", label: { in: ["2098-05", "2098-06"] } },
  });
  await prisma.agent.deleteMany({ where: { loginId: AGENT_ID } });
  await prisma.user.deleteMany({ where: { email: USER_EMAIL } });
}

const base = () => ({
  agentLoginId: AGENT_ID,
  qaOwner: "tester",
  callDate: CALL_DATE,
});

beforeAll(async () => {
  const created = await createConfigVersion(baselineConfigInput);
  configId = created.id;
  const loaded = await loadConfigById(created.id);
  if (!loaded) throw new Error("config load failed");
  config = loaded;
  ccReason = sectionByCode("CC").attributes[0].errorReasons[0].id;
  ncReason = sectionByCode("NC").attributes[0].errorReasons[0].id;

  await cleanup();
  await prisma.agent.create({
    data: {
      loginId: AGENT_ID,
      agentName: "Correct Agent",
      tlName: "TL",
      joinDate: new Date("2025-01-01"),
    },
  });
  const user = await prisma.user.create({
    data: { email: USER_EMAIL, passwordHash: "x", name: "Corrector", role: "ADMIN" },
  });
  userId = user.id;
});

afterAll(async () => {
  await cleanup();
  await prisma.scorecardConfig.deleteMany({ where: { id: configId } });
  await prisma.$disconnect();
});

describe("correctEvaluation (FR-14/15)", () => {
  it("supersedes the original, writing a re-derived version with a who/when/why audit", async () => {
    const first = await createEvaluation(config, { ...base(), flaggedReasonIds: [ccReason] });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const before = await prisma.evaluation.findUniqueOrThrow({ where: { evalId: first.evalId } });
    expect(before.overallStatus).toBe("Fail"); // a critical was flagged
    expect(before.version).toBe(1);
    expect(before.supersededAt).toBeNull();

    // Correct: the critical was flagged in error — only the non-critical stands.
    const corrected = await correctEvaluation(
      first.evalId,
      { ...base(), flaggedReasonIds: [ncReason], reason: "CC flagged in error" },
      userId,
    );
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) return;
    expect(corrected.evalId).not.toBe(first.evalId); // a NEW row, not a mutation

    // Original is preserved but stamped superseded.
    const original = await prisma.evaluation.findUniqueOrThrow({ where: { evalId: first.evalId } });
    expect(original.supersededAt).toBeInstanceOf(Date);
    expect(original.overallStatus).toBe("Fail"); // unchanged history

    // New version carries the re-derived figures + the audit fields.
    const v2 = await prisma.evaluation.findUniqueOrThrow({ where: { evalId: corrected.evalId } });
    expect(v2.version).toBe(2);
    expect(v2.correctionOfId).toBe(first.evalId);
    expect(v2.correctedById).toBe(userId);
    expect(v2.correctionReason).toBe("CC flagged in error");
    expect(v2.supersededAt).toBeNull(); // it is now the current version
    expect(v2.overallStatus).toBe("Pass"); // re-derived from the corrected flags
    expect(v2.configId).toBe(configId); // re-scored under the original's version
  });

  it("exposes the full chain as an ordered audit trail, current-only in the list", async () => {
    const first = await createEvaluation(config, { ...base(), flaggedReasonIds: [ccReason] });
    if (!first.ok) throw new Error("setup failed");
    const corrected = await correctEvaluation(
      first.evalId,
      { ...base(), flaggedReasonIds: [ncReason], reason: "fix" },
      userId,
    );
    if (!corrected.ok) throw new Error("correction failed");

    const history = await getEvaluationHistory(corrected.evalId);
    expect(history?.map((v) => v.version)).toEqual([1, 2]);
    // Resolvable from ANY version in the chain, not just the latest.
    const fromRoot = await getEvaluationHistory(first.evalId);
    expect(fromRoot?.map((v) => v.evalId)).toEqual([first.evalId, corrected.evalId]);

    const current = await listCurrentEvaluations();
    const ids = current.map((e) => e.evalId);
    expect(ids).toContain(corrected.evalId); // latest shows
    expect(ids).not.toContain(first.evalId); // superseded hidden
  });

  it("requires a reason", async () => {
    const first = await createEvaluation(config, { ...base(), flaggedReasonIds: [ncReason] });
    if (!first.ok) throw new Error("setup failed");
    const result = await correctEvaluation(
      first.evalId,
      { ...base(), flaggedReasonIds: [ncReason], reason: "   " },
      userId,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("refuses to correct a superseded version", async () => {
    const first = await createEvaluation(config, { ...base(), flaggedReasonIds: [ncReason] });
    if (!first.ok) throw new Error("setup failed");
    const v2 = await correctEvaluation(
      first.evalId,
      { ...base(), flaggedReasonIds: [ccReason], reason: "first fix" },
      userId,
    );
    if (!v2.ok) throw new Error("first correction failed");

    // first.evalId is now superseded — correcting it again must be rejected.
    const again = await correctEvaluation(
      first.evalId,
      { ...base(), flaggedReasonIds: [ncReason], reason: "second fix" },
      userId,
    );
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toContain("current version");
  });

  it("blocks a correction when the period is locked (FR-44)", async () => {
    const first = await createEvaluation(config, {
      ...base(),
      callDate: LOCK_CALL_DATE,
      flaggedReasonIds: [ncReason],
    });
    if (!first.ok) throw new Error("setup failed");

    const period = await resolveMonthlyPeriod(LOCK_CALL_DATE);
    await transitionPeriod(period.id, "LOCKED", userId);

    const result = await correctEvaluation(
      first.evalId,
      { ...base(), callDate: LOCK_CALL_DATE, flaggedReasonIds: [ccReason], reason: "late fix" },
      userId,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("2098-06");

    await transitionPeriod(period.id, "OPEN", userId); // restore for cleanup
  });
});
