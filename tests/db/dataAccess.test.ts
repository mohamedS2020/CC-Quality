/**
 * @jest-environment node
 */
import { prisma } from "@/lib/db/client";
import { agentRepository } from "@/lib/db/repositories";

/**
 * Data-access layer integration tests (task 2.9). These run against a real
 * PostgreSQL database (the dev DB locally, a Postgres service in CI) and cover:
 *   - Agent CRUD via the repository,
 *   - foreign-key + uniqueness constraint enforcement,
 *   - orphan-reason rejection (an EvaluationLine cannot reference a
 *     non-existent ErrorReason — the raw-input integrity the engine relies on).
 *
 * All fixtures use reserved id ranges (agents 800000–800099, config versions
 * 8000–8099) so tests never collide with the seed or real data, and everything
 * is cleaned up before and after the run.
 */

const AGENT_ID = 800001;
const AGENT_ID_2 = 800002;
const MISSING_AGENT_ID = 899999;
const CONFIG_VERSION = 8001;
const MISSING_REASON_ID = 999_000_001;

const RANGE = { gte: 800000, lt: 800100 };

async function cleanup() {
  // Order matters: Evaluation -> Config/Agent are Restrict (no cascade), so
  // delete evaluations (which cascade their lines) before their parents.
  await prisma.evaluation.deleteMany({ where: { agentLoginId: RANGE } });
  await prisma.scorecardConfig.deleteMany({ where: { version: CONFIG_VERSION } });
  await prisma.agent.deleteMany({ where: { loginId: RANGE } });
}

const newAgent = (loginId: number, agentName = "Test Agent") => ({
  loginId,
  agentName,
  tlName: "Test TL",
  joinDate: new Date("2025-03-01"),
});

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("agentRepository CRUD", () => {
  afterEach(async () => {
    await prisma.agent.deleteMany({ where: { loginId: RANGE } });
  });

  it("creates and reads back an agent (active by default)", async () => {
    const created = await agentRepository.create(newAgent(AGENT_ID, "Created Agent"));
    expect(created.loginId).toBe(AGENT_ID);

    const found = await agentRepository.findByLoginId(AGENT_ID);
    expect(found?.agentName).toBe("Created Agent");
    expect(found?.active).toBe(true);
  });

  it("updates an agent", async () => {
    await agentRepository.create(newAgent(AGENT_ID, "Before"));
    const updated = await agentRepository.update(AGENT_ID, { agentName: "After" });
    expect(updated.agentName).toBe("After");
  });

  it("soft-deactivates an agent and excludes it from active listings (FR-11)", async () => {
    await agentRepository.create(newAgent(AGENT_ID));
    await agentRepository.deactivate(AGENT_ID);

    const found = await agentRepository.findByLoginId(AGENT_ID);
    expect(found?.active).toBe(false);

    const active = await agentRepository.list({ activeOnly: true });
    expect(active.some((a) => a.loginId === AGENT_ID)).toBe(false);
  });

  it("resolves an agent by one of its aliases (Data Standard)", async () => {
    await agentRepository.create(newAgent(AGENT_ID, "Canonical Name"));
    await agentRepository.addAlias(AGENT_ID, "Canon Alias");

    const resolved = await agentRepository.findByAlias("Canon Alias");
    expect(resolved?.loginId).toBe(AGENT_ID);
  });
});

describe("foreign-key & uniqueness constraints", () => {
  afterEach(async () => {
    await prisma.agent.deleteMany({ where: { loginId: RANGE } });
  });

  it("rejects an alias for a non-existent agent (FK violation P2003)", async () => {
    await expect(agentRepository.addAlias(MISSING_AGENT_ID, "Orphan Alias")).rejects.toMatchObject({
      code: "P2003",
    });
  });

  it("rejects a duplicate alias across agents (unique violation P2002)", async () => {
    await agentRepository.create(newAgent(AGENT_ID, "A"));
    await agentRepository.create(newAgent(AGENT_ID_2, "B"));
    await agentRepository.addAlias(AGENT_ID, "Shared Alias");

    await expect(agentRepository.addAlias(AGENT_ID_2, "Shared Alias")).rejects.toMatchObject({
      code: "P2002",
    });
  });
});

describe("evaluation line integrity (orphan-reason rejection)", () => {
  let configId: number;
  let evalId: string;
  let reasonId: number;

  beforeAll(async () => {
    const config = await prisma.scorecardConfig.create({
      data: { version: CONFIG_VERSION, name: "Test Config" },
    });
    configId = config.id;

    const section = await prisma.section.create({
      data: {
        configId,
        code: "TCC",
        label: "Test Section",
        orderIndex: 0,
        scoringMode: "SECTION_BINARY",
        critical: true,
        rankWeight: 100,
        rankBenchmark: 0.99,
      },
    });
    const category = await prisma.category.create({
      data: { sectionId: section.id, label: "Test Category", orderIndex: 0 },
    });
    const attribute = await prisma.attribute.create({
      data: { categoryId: category.id, label: "Test Attribute", orderIndex: 0 },
    });
    const reason = await prisma.errorReason.create({
      data: { attributeId: attribute.id, label: "Test Reason", orderIndex: 0 },
    });
    reasonId = reason.id;

    await agentRepository.create(newAgent(AGENT_ID, "Eval Agent"));
    const evaluation = await prisma.evaluation.create({
      data: {
        agentLoginId: AGENT_ID,
        configId,
        qaOwner: "tester",
        callDate: new Date("2025-07-01"),
      },
    });
    evalId = evaluation.evalId;
  });

  it("rejects a line referencing a non-existent error reason (orphan reason, P2003)", async () => {
    await expect(
      prisma.evaluationLine.create({
        data: { evaluationId: evalId, errorReasonId: MISSING_REASON_ID },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects a line referencing a non-existent evaluation (FK, P2003)", async () => {
    await expect(
      prisma.evaluationLine.create({
        data: { evaluationId: "does-not-exist", errorReasonId: reasonId },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("accepts a valid line and enforces one flag per reason per call (P2002)", async () => {
    const line = await prisma.evaluationLine.create({
      data: { evaluationId: evalId, errorReasonId: reasonId },
    });
    expect(line.id).toBeGreaterThan(0);

    await expect(
      prisma.evaluationLine.create({
        data: { evaluationId: evalId, errorReasonId: reasonId },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
