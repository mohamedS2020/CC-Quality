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
/** In the NEXT month and mid-afternoon — guards cross-month ranges + the half-open bound. */
const LATE_CALL_DATE = new Date("2096-06-20T13:45:00Z");

let config: LoadedConfig;
let configId: number;
let periodId: number;

async function cleanup() {
  await prisma.evaluation.deleteMany({ where: { agentLoginId: { gte: 930000, lt: 930100 } } });
  await prisma.period.deleteMany({
    where: { type: "MONTH", label: { in: ["2096-05", "2096-06"] } },
  });
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
  // One more call, next month + mid-afternoon, for the date-range tests only.
  await createEvaluation(config, {
    agentLoginId: A2,
    qaOwner: "qa",
    callDate: LATE_CALL_DATE,
    flaggedReasonIds: [],
  });

  periodId = (await resolveMonthlyPeriod(CALL_DATE)).id;
});

afterAll(async () => {
  await cleanup();
  await prisma.scorecardConfig.deleteMany({ where: { id: configId } });
  await prisma.$disconnect();
});

describe("report scope filtering", () => {
  const lens = () => pickLens(config)!;
  const win = () => ({ current: { kind: "period" as const, periodId }, previous: null });

  it("account scope includes every agent's calls", async () => {
    const r = await loadReport(config, lens(), { kind: "account" }, win());
    expect(r.kpis.callCount).toBe(3);
    expect(r.kpis.agentCount).toBe(2);
  });

  it("TL scope includes only that team's agents", async () => {
    const r = await loadReport(config, lens(), { kind: "tl", tlName: "Alpha" }, win());
    expect(r.kpis.callCount).toBe(2);
    expect(r.kpis.agentCount).toBe(1);
    expect(r.leaderboard.map((x) => x.agentName)).toEqual(["Ann"]);
  });

  it("agent scope includes only that agent's calls", async () => {
    const bo = await loadReport(config, lens(), { kind: "agent", loginId: A2 }, win());
    expect(bo.kpis.callCount).toBe(1);
    expect(bo.kpis.agentCount).toBe(1);
    expect(bo.leaderboard.map((x) => x.agentName)).toEqual(["Bo"]);
  });
});

describe("report date-range filtering", () => {
  const lens = () => pickLens(config)!;
  /** Build the half-open slice the resolver produces for a From/To pair. */
  const range = (from: string, to: string) => ({
    current: {
      kind: "range" as const,
      from: new Date(`${from}T00:00:00Z`),
      toExclusive: new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000),
    },
    previous: null,
  });
  const count = async (from: string, to: string) =>
    (await loadReport(config, lens(), { kind: "account" }, range(from, to))).kpis.callCount;

  it("spans months and includes a call timestamped during the final day", async () => {
    // The 2096-06-20 13:45 call must be inside a range ENDING on 2096-06-20; an
    // inclusive `lte: to` (UTC midnight) would silently drop it.
    expect(await count("2096-05-01", "2096-06-20")).toBe(4);
  });

  it("excludes the final-day call when the range stops the day before", async () => {
    expect(await count("2096-05-01", "2096-06-19")).toBe(3);
  });

  it("a single-day range selects exactly that day", async () => {
    expect(await count("2096-05-15", "2096-05-15")).toBe(3);
    expect(await count("2096-05-16", "2096-05-16")).toBe(0);
  });

  // The two filters are independent predicates ANDed into one `where`, so a
  // report is always "this agent AND this stretch of time", never one or other.
  it("composes with an agent scope", async () => {
    const forAgent = async (loginId: number, from: string, to: string) =>
      await loadReport(config, lens(), { kind: "agent", loginId }, range(from, to));

    // Bo has both a 2096-05-15 call and the 2096-06-20 one.
    const boBoth = await forAgent(A2, "2096-05-01", "2096-06-20");
    expect(boBoth.kpis.callCount).toBe(2);
    expect(boBoth.leaderboard.map((x) => x.agentName)).toEqual(["Bo"]);

    // Narrowing the window to June leaves only Bo's June call…
    expect((await forAgent(A2, "2096-06-01", "2096-06-20")).kpis.callCount).toBe(1);
    // …and Ann, who scored nothing in June, correctly reports no calls.
    expect((await forAgent(A1, "2096-06-01", "2096-06-20")).kpis.callCount).toBe(0);
    // Ann's own May calls are still hers alone (not Bo's) inside a shared window.
    expect((await forAgent(A1, "2096-05-01", "2096-06-20")).kpis.callCount).toBe(2);
  });
});
