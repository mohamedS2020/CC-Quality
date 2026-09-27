/**
 * @jest-environment node
 *
 * REGRESSION: publishing a new config version must not change what an already
 * scored call means.
 *
 * A config version deep-copies the rubric, minting fresh `ErrorReason` ids.
 * EvaluationLine rows keep pointing at the OLD version's ids, so before stable
 * keys existed, activating a new version made every flag fail to resolve — the
 * engine silently skipped them and every report read a perfect 100%.
 */
import { prisma } from "@/lib/db/client";
import { baselineConfigInput } from "@/lib/config/baseline";
import { buildInputFromLoaded, createConfigVersion } from "@/lib/config/versioning";
import { loadConfigById, resolveStoredFlags, type LoadedConfig } from "@/lib/config/loader";
import { scoreCall } from "@/lib/engine/score";
import { createEvaluation } from "@/lib/evaluations/create";
import { resolveMonthlyPeriod } from "@/lib/periods/period";
import { loadReport, pickLens, type Report } from "@/lib/reports/metrics";

const AGENT = 931001;
const CALL_DATE = new Date("2097-04-12T00:00:00Z");

let v1: LoadedConfig;
let v2: LoadedConfig;
let periodId: number;
const createdConfigIds: number[] = [];
/** This test activates its own version; remember what to hand back. */
let previouslyActiveId: number | null = null;

async function cleanup() {
  await prisma.evaluation.deleteMany({ where: { agentLoginId: AGENT } });
  await prisma.period.deleteMany({ where: { type: "MONTH", label: "2097-04" } });
  await prisma.agent.deleteMany({ where: { loginId: AGENT } });
}

const win = () => ({ current: { kind: "period" as const, periodId }, previous: null });
const report = (cfg: LoadedConfig): Promise<Report> =>
  loadReport(cfg, pickLens(cfg)!, { kind: "account" }, win());

/** A section's accuracy keyed by CODE — ids differ across versions, codes don't. */
function byCode(r: Report): Record<string, number> {
  return Object.fromEntries(r.sections.map((s) => [s.code, s.accuracy]));
}

beforeAll(async () => {
  await cleanup();

  previouslyActiveId =
    (await prisma.scorecardConfig.findFirst({ where: { isActive: true }, select: { id: true } }))
      ?.id ?? null;

  const first = await createConfigVersion(baselineConfigInput);
  createdConfigIds.push(first.id);
  const loadedFirst = await loadConfigById(first.id);
  if (!loadedFirst) throw new Error("v1 load failed");
  v1 = loadedFirst;

  await prisma.agent.create({
    data: {
      loginId: AGENT,
      agentName: "Version Ann",
      tlName: "Versions",
      joinDate: new Date("2025-01-01"),
    },
  });

  // Score real errors under v1: one call with a critical CC error, one clean.
  const ccSection = v1.sections.find((s) => s.code === "CC")!;
  const ccReason = ccSection.attributes[0].errorReasons[0];
  await createEvaluation(v1, {
    agentLoginId: AGENT,
    qaOwner: "qa",
    callDate: CALL_DATE,
    flaggedReasonIds: [ccReason.id],
  });
  await createEvaluation(v1, {
    agentLoginId: AGENT,
    qaOwner: "qa",
    callDate: CALL_DATE,
    flaggedReasonIds: [],
  });
  periodId = (await resolveMonthlyPeriod(CALL_DATE)).id;

  // Publish a SECOND version — the exact thing that broke reports: an edited
  // benchmark, everything else identical.
  const edited = buildInputFromLoaded(v1);
  edited.lenses[0].benchmarks[0].threshold = 0.85;
  const second = await createConfigVersion(edited, { activate: true });
  createdConfigIds.push(second.id);
  const loadedSecond = await loadConfigById(second.id);
  if (!loadedSecond) throw new Error("v2 load failed");
  v2 = loadedSecond;
});

afterAll(async () => {
  await cleanup();
  await prisma.scorecardConfig.deleteMany({ where: { id: { in: createdConfigIds } } });
  // Hand the active pointer back: deleting the version this test activated would
  // otherwise leave the database with NO active config.
  if (previouslyActiveId != null) {
    await prisma.scorecardConfig.update({
      where: { id: previouslyActiveId },
      data: { isActive: true },
    });
  }
  await prisma.$disconnect();
});

describe("config version publish", () => {
  it("mints fresh error-reason ids but preserves the stable keys", () => {
    const idsV1 = [...v1.errorReasonById.keys()].sort();
    const idsV2 = [...v2.errorReasonById.keys()].sort();
    expect(idsV1).not.toEqual(idsV2); // the hazard is real...
    expect(idsV1.some((id) => idsV2.includes(id))).toBe(false); // ...and total

    // ...but identity survives, which is what relinks the history.
    expect([...v2.errorReasonByKey.keys()].sort()).toEqual([...v1.errorReasonByKey.keys()].sort());
  });

  it("reports the SAME figures under the new version (the 100% bug)", async () => {
    const before = await report(v1);
    const after = await report(v2);

    expect(after.kpis.callCount).toBe(2);
    expect(byCode(after)).toEqual(byCode(before));
    expect(after.unresolvedFlags).toBe(0);
  });

  it("still sees the CC error — it does not silently read 100%", async () => {
    const after = await report(v2);
    const cc = after.sections.find((s) => s.code === "CC")!;
    expect(cc.accuracy).toBeLessThan(1); // 1 of 2 calls had a CC error
    expect(cc.numerator).toBe(1);
    expect(after.kpis.passRate).toBeCloseTo(0.5);
  });

  it("counts flags the rubric no longer contains instead of dropping them", () => {
    // Simulate a reason genuinely deleted from the rubric: score against an id
    // that belongs to no version. The engine must COUNT it, never ignore it.
    const scored = scoreCall(v2, [-999]);
    expect(scored.unresolvedFlags).toBe(1);
    expect(scored.failedScorecard).toBe(false); // it can't invent a section...
    expect(scored.sumOfCriticals).toBe(0); // ...but the caller is told
  });

  it("pins the original defect: raw v1 ids under v2 score as a clean pass", () => {
    const ccReasonV1 = v1.sections.find((s) => s.code === "CC")!.attributes[0].errorReasons[0];

    // Exactly what the old read path did — hand STORED (v1) ids to the ACTIVE
    // (v2) config. A real critical error evaporates into a perfect score; this
    // is the whole "everything is 100% and green" report.
    const naive = scoreCall(v2, [ccReasonV1.id]);
    expect(naive.sumOfCriticals).toBe(0);
    expect(naive.failedScorecard).toBe(false);
    expect(naive.unresolvedFlags).toBe(1); // no longer silent

    // Resolving through the stable key first recovers the truth.
    const { reasonIds, unresolved } = resolveStoredFlags(v2, [ccReasonV1.key]);
    expect(unresolved).toBe(0);
    const correct = scoreCall(v2, reasonIds);
    expect(correct.sumOfCriticals).toBe(1);
    expect(correct.failedScorecard).toBe(true);
    expect(correct.unresolvedFlags).toBe(0);
  });
});
