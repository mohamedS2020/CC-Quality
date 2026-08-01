/**
 * @jest-environment node
 */
import type { AuthContext, PublicUser } from "@/lib/auth/context";
import { agentScopeFor, evaluationScopeWhere } from "@/lib/auth/scope";
import { prisma } from "@/lib/db/client";
import type { UserRole } from "@prisma/client";

// Ids disjoint from other DB test files so parallel Jest workers never collide.
const AGENT_1 = 810001;
const AGENT_2 = 810002;
const CONFIG_VERSION = 8101;
const RANGE = { gte: 810000, lt: 810100 };

function ctx(role: UserRole, agentLoginId: number | null = null): AuthContext {
  const user: PublicUser = {
    id: 1,
    email: "scope@cc-quality.test",
    name: "Scope",
    role,
    active: true,
    agentLoginId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { user, permissions: new Set() };
}

async function cleanup() {
  await prisma.evaluation.deleteMany({ where: { agentLoginId: RANGE } });
  await prisma.scorecardConfig.deleteMany({ where: { version: CONFIG_VERSION } });
  await prisma.agent.deleteMany({ where: { loginId: RANGE } });
}

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("agent self-scoping (FR-9)", () => {
  it("scopes an Agent to their own login_id; Admins and Moderators see all", () => {
    expect(agentScopeFor(ctx("AGENT", AGENT_1))).toEqual({ kind: "self", loginId: AGENT_1 });
    expect(agentScopeFor(ctx("ADMIN"))).toEqual({ kind: "all" });
    expect(agentScopeFor(ctx("MODERATOR"))).toEqual({ kind: "all" });
  });

  it("fails closed for an Agent with no linked record (matches no rows)", () => {
    const scope = agentScopeFor(ctx("AGENT", null));
    expect(scope).toEqual({ kind: "self", loginId: -1 });
    expect(evaluationScopeWhere(scope)).toEqual({ agentLoginId: -1 });
  });

  it("returns only the scoped agent's evaluations from the DB", async () => {
    const config = await prisma.scorecardConfig.create({
      data: { version: CONFIG_VERSION, name: "Scope Config" },
    });
    for (const loginId of [AGENT_1, AGENT_2]) {
      await prisma.agent.create({
        data: { loginId, agentName: `A${loginId}`, tlName: "TL", joinDate: new Date("2025-01-01") },
      });
    }
    const eval1 = await prisma.evaluation.create({
      data: { agentLoginId: AGENT_1, configId: config.id, qaOwner: "qa", callDate: new Date() },
    });
    const eval2 = await prisma.evaluation.create({
      data: { agentLoginId: AGENT_2, configId: config.id, qaOwner: "qa", callDate: new Date() },
    });

    const selfRows = await prisma.evaluation.findMany({
      where: evaluationScopeWhere(agentScopeFor(ctx("AGENT", AGENT_1))),
    });
    const selfIds = selfRows.map((r) => r.evalId);
    expect(selfIds).toContain(eval1.evalId);
    expect(selfIds).not.toContain(eval2.evalId);
    expect(selfRows.every((r) => r.agentLoginId === AGENT_1)).toBe(true);

    const allRows = await prisma.evaluation.findMany({
      where: evaluationScopeWhere(agentScopeFor(ctx("ADMIN"))),
    });
    expect(allRows.map((r) => r.evalId)).toEqual(
      expect.arrayContaining([eval1.evalId, eval2.evalId]),
    );
  });
});
