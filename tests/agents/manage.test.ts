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

async function cleanup() {
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
});
