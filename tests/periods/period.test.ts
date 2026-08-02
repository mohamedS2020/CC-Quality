/**
 * @jest-environment node
 *
 * Period lifecycle (task 6.7): open → scoring → review → locked → reopen, with
 * lock/reopen audit (FR-45), and the FR-44 guarantee that a locked period
 * rejects new evaluations. Uses a distinct far-future month so its period never
 * collides with the months other suites score in.
 */
import { prisma } from "@/lib/db/client";
import { baselineConfigInput } from "@/lib/config/baseline";
import { createConfigVersion } from "@/lib/config/versioning";
import { loadConfigById, type LoadedConfig } from "@/lib/config/loader";
import { createEvaluation } from "@/lib/evaluations/create";
import {
  canTransition,
  isPeriodEditable,
  monthPeriodBounds,
  resolveMonthlyPeriod,
  transitionPeriod,
} from "@/lib/periods/period";

const AGENT_ID = 860001;
const PERIOD_LABEL = "2099-07";
const CALL_DATE = new Date("2099-07-15T00:00:00Z");
const USER_EMAIL = "period-test@example.com";

let config: LoadedConfig;
let configId: number;
let userId: number;
let ncReason: number;

async function cleanup() {
  await prisma.evaluation.deleteMany({ where: { agentLoginId: AGENT_ID } });
  await prisma.period.deleteMany({ where: { type: "MONTH", label: PERIOD_LABEL } });
  await prisma.agent.deleteMany({ where: { loginId: AGENT_ID } });
  await prisma.user.deleteMany({ where: { email: USER_EMAIL } });
}

beforeAll(async () => {
  const created = await createConfigVersion(baselineConfigInput);
  configId = created.id;
  const loaded = await loadConfigById(created.id);
  if (!loaded) throw new Error("config load failed");
  config = loaded;
  const nc = config.sections.find((s) => s.code === "NC");
  if (!nc) throw new Error("missing NC section");
  ncReason = nc.attributes[0].errorReasons[0].id;

  await cleanup();
  await prisma.agent.create({
    data: {
      loginId: AGENT_ID,
      agentName: "Period Agent",
      tlName: "TL",
      joinDate: new Date("2025-01-01"),
    },
  });
  const user = await prisma.user.create({
    data: { email: USER_EMAIL, passwordHash: "x", name: "Period Tester", role: "ADMIN" },
  });
  userId = user.id;
});

afterAll(async () => {
  await cleanup();
  await prisma.scorecardConfig.deleteMany({ where: { id: configId } });
  await prisma.$disconnect();
});

describe("period math and transition rules (pure)", () => {
  it("computes month bounds", () => {
    expect(monthPeriodBounds(new Date("2099-07-15T12:00:00Z"))).toEqual({
      label: "2099-07",
      start: new Date(Date.UTC(2099, 6, 1)),
      end: new Date(Date.UTC(2099, 6, 31)),
    });
  });

  it("allows the lifecycle flow and blocks illegal jumps", () => {
    expect(canTransition("OPEN", "SCORING")).toBe(true);
    expect(canTransition("SCORING", "LOCKED")).toBe(true);
    expect(canTransition("LOCKED", "OPEN")).toBe(true); // reopen
    expect(canTransition("LOCKED", "SCORING")).toBe(false); // must reopen first
  });

  it("treats only LOCKED as non-editable", () => {
    expect(isPeriodEditable({ status: "OPEN" })).toBe(true);
    expect(isPeriodEditable({ status: "REVIEW" })).toBe(true);
    expect(isPeriodEditable({ status: "LOCKED" })).toBe(false);
  });
});

describe("period lifecycle (DB)", () => {
  it("opens a period on demand, idempotently", async () => {
    const first = await resolveMonthlyPeriod(CALL_DATE);
    const second = await resolveMonthlyPeriod(CALL_DATE);
    expect(first.label).toBe(PERIOD_LABEL);
    expect(first.status).toBe("OPEN");
    expect(second.id).toBe(first.id); // find-or-create, not a duplicate
  });

  it("locks a call's period, blocking new evaluations, then reopens it (FR-44)", async () => {
    const period = await resolveMonthlyPeriod(CALL_DATE);

    // Editable while open.
    const openResult = await createEvaluation(config, {
      agentLoginId: AGENT_ID,
      qaOwner: "tester",
      callDate: CALL_DATE,
      flaggedReasonIds: [ncReason],
    });
    expect(openResult.ok).toBe(true);

    // Lock stamps who/when (FR-45).
    const locked = await transitionPeriod(period.id, "LOCKED", userId);
    expect(locked.ok).toBe(true);
    if (!locked.ok) return;
    expect(locked.period.status).toBe("LOCKED");
    expect(locked.period.lockedById).toBe(userId);
    expect(locked.period.lockedAt).toBeInstanceOf(Date);

    // Locked → no new call may land in it.
    const blocked = await createEvaluation(config, {
      agentLoginId: AGENT_ID,
      qaOwner: "tester",
      callDate: CALL_DATE,
      flaggedReasonIds: [ncReason],
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toContain(PERIOD_LABEL);

    // Reopen restores editability and stamps the reopen audit.
    const reopened = await transitionPeriod(period.id, "OPEN", userId);
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.period.status).toBe("OPEN");
    expect(reopened.period.reopenedById).toBe(userId);

    const afterReopen = await createEvaluation(config, {
      agentLoginId: AGENT_ID,
      qaOwner: "tester",
      callDate: CALL_DATE,
      flaggedReasonIds: [ncReason],
    });
    expect(afterReopen.ok).toBe(true);
  });

  it("rejects an illegal transition", async () => {
    const period = await resolveMonthlyPeriod(CALL_DATE);
    await transitionPeriod(period.id, "LOCKED", userId);
    const bad = await transitionPeriod(period.id, "SCORING", userId);
    expect(bad.ok).toBe(false);
    await transitionPeriod(period.id, "OPEN", userId); // restore for cleanup
  });
});
