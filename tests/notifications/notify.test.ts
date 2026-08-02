/**
 * @jest-environment node
 *
 * Notifications (task 8.7/8.8, FR-39/40/41): scoring/correcting a call notifies
 * the AGENT USER linked to that agent — and only them (scope isolation). Covers
 * notification-on-score, correction notifications, unread→read, and that an
 * agent with no linked user is not notified. Disjoint id range + email tag.
 */
import { prisma } from "@/lib/db/client";
import { baselineConfigInput } from "@/lib/config/baseline";
import { createConfigVersion } from "@/lib/config/versioning";
import { loadConfigById, type LoadedConfig, type LoadedSection } from "@/lib/config/loader";
import { createEvaluation } from "@/lib/evaluations/create";
import { correctEvaluation } from "@/lib/evaluations/correct";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
} from "@/lib/notifications/service";

const AGENT_1 = 920001; // linked to user1 (recipient)
const AGENT_2 = 920002; // linked to user2 (other agent)
const AGENT_3 = 920003; // no linked user
const EMAIL_TAG = "@notif.test";
const CALL_DATE = new Date("2097-05-15T00:00:00Z");

let config: LoadedConfig;
let configId: number;
let user1: number;
let user2: number;
let corrector: number;
let ccReason: number;
let ncReason: number;

const sectionByCode = (code: string): LoadedSection => {
  const s = config.sections.find((x) => x.code === code);
  if (!s) throw new Error(`missing ${code}`);
  return s;
};

async function cleanup() {
  await prisma.notification.deleteMany({ where: { user: { email: { contains: EMAIL_TAG } } } });
  await prisma.evaluation.deleteMany({ where: { agentLoginId: { gte: 920000, lt: 920100 } } });
  await prisma.period.deleteMany({ where: { type: "MONTH", label: "2097-05" } });
  await prisma.user.deleteMany({ where: { email: { contains: EMAIL_TAG } } });
  await prisma.agent.deleteMany({ where: { loginId: { gte: 920000, lt: 920100 } } });
}

beforeAll(async () => {
  const created = await createConfigVersion(baselineConfigInput);
  configId = created.id;
  const loaded = await loadConfigById(created.id);
  if (!loaded) throw new Error("config load failed");
  config = loaded;
  ccReason = sectionByCode("CC").attributes[0].errorReasons[0].id;
  ncReason = sectionByCode("NC").attributes[0].errorReasons[0].id;

  await cleanup();
  await prisma.agent.createMany({
    data: [AGENT_1, AGENT_2, AGENT_3].map((loginId) => ({
      loginId,
      agentName: `Agent ${loginId}`,
      tlName: "TL",
      joinDate: new Date("2025-01-01"),
    })),
  });
  const u1 = await prisma.user.create({
    data: {
      email: `a1${EMAIL_TAG}`,
      passwordHash: "x",
      name: "Agent One",
      role: "AGENT",
      agentLoginId: AGENT_1,
    },
  });
  const u2 = await prisma.user.create({
    data: {
      email: `a2${EMAIL_TAG}`,
      passwordHash: "x",
      name: "Agent Two",
      role: "AGENT",
      agentLoginId: AGENT_2,
    },
  });
  const c = await prisma.user.create({
    data: { email: `mod${EMAIL_TAG}`, passwordHash: "x", name: "Corrector", role: "ADMIN" },
  });
  user1 = u1.id;
  user2 = u2.id;
  corrector = c.id;
});

afterAll(async () => {
  await cleanup();
  await prisma.scorecardConfig.deleteMany({ where: { id: configId } });
  await prisma.$disconnect();
});

describe("notifications", () => {
  it("notifies only the scored agent's own user (scope isolation)", async () => {
    const result = await createEvaluation(config, {
      agentLoginId: AGENT_1,
      qaOwner: "qa",
      callDate: CALL_DATE,
      flaggedReasonIds: [ncReason],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const forUser1 = await listNotifications(user1);
    expect(forUser1).toHaveLength(1);
    expect(forUser1[0]).toMatchObject({ type: "SCORE_POSTED", evaluationId: result.evalId });
    expect(forUser1[0].readAt).toBeNull();

    // The other agent's user gets nothing.
    expect(await listNotifications(user2)).toHaveLength(0);
    expect(await unreadNotificationCount(user2)).toBe(0);
  });

  it("notifies on a correction, and marks read (unread → read)", async () => {
    const first = await createEvaluation(config, {
      agentLoginId: AGENT_1,
      qaOwner: "qa",
      callDate: CALL_DATE,
      flaggedReasonIds: [ncReason],
    });
    if (!first.ok) throw new Error("setup failed");

    const before = await unreadNotificationCount(user1);
    expect(before).toBeGreaterThanOrEqual(1);

    const corrected = await correctEvaluation(
      first.evalId,
      {
        agentLoginId: AGENT_1,
        qaOwner: "qa",
        callDate: CALL_DATE,
        flaggedReasonIds: [ccReason],
        reason: "fix",
      },
      corrector,
    );
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) return;

    const all = await listNotifications(user1);
    expect(
      all.some((n) => n.type === "CORRECTION_POSTED" && n.evaluationId === corrected.evalId),
    ).toBe(true);

    // Mark the newest one read → unread count drops by one.
    const unreadBefore = await unreadNotificationCount(user1);
    await markNotificationRead(all[0].id, user1);
    expect(await unreadNotificationCount(user1)).toBe(unreadBefore - 1);

    // Mark all read → zero unread.
    await markAllNotificationsRead(user1);
    expect(await unreadNotificationCount(user1)).toBe(0);
  });

  it("does not notify when the agent has no linked user (no crash)", async () => {
    const before =
      (await listNotifications(user1)).length + (await listNotifications(user2)).length;
    const result = await createEvaluation(config, {
      agentLoginId: AGENT_3,
      qaOwner: "qa",
      callDate: CALL_DATE,
      flaggedReasonIds: [ncReason],
    });
    expect(result.ok).toBe(true);
    const after = (await listNotifications(user1)).length + (await listNotifications(user2)).length;
    expect(after).toBe(before); // no new notifications for anyone
  });

  it("scopes read operations to the owner (can't read another user's)", async () => {
    const result = await createEvaluation(config, {
      agentLoginId: AGENT_1,
      qaOwner: "qa",
      callDate: CALL_DATE,
      flaggedReasonIds: [ncReason],
    });
    if (!result.ok) throw new Error("setup failed");
    const [notif] = await listNotifications(user1);

    // user2 trying to mark user1's notification read does nothing.
    await markNotificationRead(notif.id, user2);
    const reloaded = await prisma.notification.findUniqueOrThrow({ where: { id: notif.id } });
    expect(reloaded.readAt).toBeNull();
  });
});
