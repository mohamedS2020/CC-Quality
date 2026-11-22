/**
 * @jest-environment node
 *
 * Agent-dimension CRUD (FR-11, task 7.3): create/update with the field rules and
 * the unique login_id. Uses a login-id range disjoint from other suites.
 */
import { prisma } from "@/lib/db/client";
import { createAgent, updateAgent } from "@/lib/agents/manage";

const LOGIN = 880001;
const RANGE = { gte: 880000, lt: 880100 };

const TAG = "@agentmail.test";

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { contains: TAG } } });
  await prisma.agent.deleteMany({ where: { loginId: RANGE } });
}

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("agent management", () => {
  it("creates an agent and rejects a duplicate login id", async () => {
    const created = await createAgent({
      loginId: LOGIN,
      agentName: "Hager",
      tlName: "Team Lead",
      joinDate: new Date("2025-06-01"),
    });
    expect(created).toEqual({ ok: true, loginId: LOGIN });

    const dup = await createAgent({
      loginId: LOGIN,
      agentName: "Someone Else",
      tlName: "TL",
      joinDate: new Date("2025-06-01"),
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toContain(String(LOGIN));
  });

  it("rejects invalid fields", async () => {
    expect(
      await createAgent({
        loginId: -5,
        agentName: "X",
        tlName: "T",
        joinDate: new Date("2025-01-01"),
      }),
    ).toMatchObject({ ok: false });
    expect(
      await createAgent({
        loginId: 880002,
        agentName: "  ",
        tlName: "T",
        joinDate: new Date("2025-01-01"),
      }),
    ).toMatchObject({ ok: false });
  });

  it("updates fields and deactivates; rejects an unknown agent", async () => {
    const ok = await updateAgent(LOGIN, {
      agentName: "Hager Updated",
      tlName: "New TL",
      joinDate: new Date("2025-07-01"),
      active: false,
    });
    expect(ok).toEqual({ ok: true, loginId: LOGIN });

    const saved = await prisma.agent.findUniqueOrThrow({ where: { loginId: LOGIN } });
    expect(saved.agentName).toBe("Hager Updated");
    expect(saved.tlName).toBe("New TL");
    expect(saved.active).toBe(false);

    const missing = await updateAgent(880099, {
      agentName: "Ghost",
      tlName: "T",
      joinDate: new Date("2025-01-01"),
      active: true,
    });
    expect(missing.ok).toBe(false);
  });

  it("stores a normalised email, and rejects a bad or duplicate one", async () => {
    const a = await createAgent({
      loginId: 880010,
      agentName: "Mail One",
      tlName: "TL",
      joinDate: new Date("2025-01-01"),
      email: `  One${TAG} `,
    });
    expect(a.ok).toBe(true);
    expect((await prisma.agent.findUniqueOrThrow({ where: { loginId: 880010 } })).email).toBe(
      `one${TAG}`,
    );

    const bad = await createAgent({
      loginId: 880011,
      agentName: "Bad",
      tlName: "TL",
      joinDate: new Date("2025-01-01"),
      email: "not-an-email",
    });
    expect(bad).toEqual({ ok: false, error: expect.stringContaining("not a valid email") });

    const dup = await createAgent({
      loginId: 880012,
      agentName: "Dup",
      tlName: "TL",
      joinDate: new Date("2025-01-01"),
      email: `one${TAG}`,
    });
    expect(dup).toEqual({ ok: false, error: expect.stringContaining("already uses") });
  });

  it("keeps the email when an update doesn't mention it, and clears it on empty", async () => {
    const base = {
      agentName: "Mail One",
      tlName: "TL",
      joinDate: new Date("2025-01-01"),
      active: true,
    };
    expect((await updateAgent(880010, base)).ok).toBe(true);
    expect((await prisma.agent.findUniqueOrThrow({ where: { loginId: 880010 } })).email).toBe(
      `one${TAG}`,
    );
    expect((await updateAgent(880010, { ...base, email: "" })).ok).toBe(true);
    expect((await prisma.agent.findUniqueOrThrow({ where: { loginId: 880010 } })).email).toBeNull();
  });

  it("moves a linked login's email with the agent's, and won't let it go blank", async () => {
    await createAgent({
      loginId: 880020,
      agentName: "Linked",
      tlName: "TL",
      joinDate: new Date("2025-01-01"),
      email: `linked${TAG}`,
    });
    const user = await prisma.user.create({
      data: {
        email: `linked${TAG}`,
        passwordHash: "x",
        name: "Linked",
        role: "AGENT",
        agentLoginId: 880020,
      },
    });
    const base = {
      agentName: "Linked",
      tlName: "TL",
      joinDate: new Date("2025-01-01"),
      active: true,
    };

    expect((await updateAgent(880020, { ...base, email: `new-linked${TAG}` })).ok).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(
      `new-linked${TAG}`,
    );

    const blank = await updateAgent(880020, { ...base, email: "" });
    expect(blank).toEqual({ ok: false, error: expect.stringContaining("can't be empty") });

    // Someone else's login address can't be taken over.
    await prisma.user.create({
      data: { email: `admin${TAG}`, passwordHash: "x", name: "Admin", role: "ADMIN" },
    });
    const clash = await updateAgent(880020, { ...base, email: `admin${TAG}` });
    expect(clash).toEqual({ ok: false, error: expect.stringContaining("already uses") });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(
      `new-linked${TAG}`,
    );
  });
});
