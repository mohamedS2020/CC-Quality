/**
 * @jest-environment node
 *
 * Report scope filtering (task 9.8, FR-42): account / TL / agent select exactly
 * the right calls. Uses a self-created inactive config + a far-future month.
 */
import { prisma } from "@/lib/db/client";
import { baselineConfigInput } from "@/lib/config/baseline";
import { createConfigVersion } from "@/lib/config/versioning";
import { loadConfigById, type LoadedConfig } from "@/lib/config/loader";
import { createEvaluation } from "@/lib/evaluations/create";
import { resolveMonthlyPeriod } from "@/lib/periods/period";
import { loadReport, pickLens } from "@/lib/reports/metrics";

const A1 = 930001; // team Alpha
const A2 = 930002; // team Beta
const CALL_DATE = new Date("2096-05-15T00:00:00Z");

let config: LoadedConfig;
let configId: number;
let periodId: number;

async function cleanup() {
  await prisma.evaluation.deleteMany({ where: { agentLoginId: { gte: 930000, lt: 930100 } } });
  await prisma.period.deleteMany({ where: { type: "MONTH", label: "2096-05" } });
  await prisma.agent.deleteMany({ where: { loginId: { gte: 930000, lt: 930100 } } });
}

beforeAll(async () => {
  const created = await createConfigVersion(baselineConfigInput);
  configId = created.id;
  const loaded = await loadConfigById(created.id);
  if (!loaded) throw new Error("config load failed");
  config = loaded;

  await cleanup();
  await prisma.agent.createMany({
    data: [
      { loginId: A1, agentName: "Ann", tlName: "Alpha", joinDate: new Date("2025-01-01") },
      { loginId: A2, agentName: "Bo", tlName: "Beta", joinDate: new Date("2025-01-01") },
    ],
  });

  // Ann: 2 calls, Bo: 1 call — all clean.
  for (const agentLoginId of [A1, A1, A2]) {
    await createEvaluation(config, {
      agentLoginId,
      qaOwner: "qa",
      callDate: CALL_DATE,
      flaggedReasonIds: [],
    });
  }
  periodId = (await resolveMonthlyPeriod(CALL_DATE)).id;
});

afterAll(async () => {
  await cleanup();
  await prisma.scorecardConfig.deleteMany({ where: { id: configId } });
  await prisma.$disconnect();
});

describe("report scope filtering", () => {
  const lens = () => pickLens(config)!;

  it("account scope includes every agent's calls", async () => {
    const r = await loadReport(config, lens(), { kind: "account" }, periodId, null);
    expect(r.kpis.callCount).toBe(3);
    expect(r.kpis.agentCount).toBe(2);
  });

  it("TL scope includes only that team's agents", async () => {
    const r = await loadReport(config, lens(), { kind: "tl", tlName: "Alpha" }, periodId, null);
    expect(r.kpis.callCount).toBe(2);
    expect(r.kpis.agentCount).toBe(1);
    expect(r.leaderboard.map((x) => x.agentName)).toEqual(["Ann"]);
  });

  it("agent scope includes only that agent's calls", async () => {
    const bo = await loadReport(config, lens(), { kind: "agent", loginId: A2 }, periodId, null);
    expect(bo.kpis.callCount).toBe(1);
    expect(bo.kpis.agentCount).toBe(1);
    expect(bo.leaderboard.map((x) => x.agentName)).toEqual(["Bo"]);
  });
});
