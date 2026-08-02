/**
 * @jest-environment node
 *
 * Data Standard name normalization (task 6.3, FR-12): resolve a raw agent name —
 * canonical, whitespace/case variant, or an Arabic/alternate alias — to the
 * canonical Agent; unknown names resolve to null.
 */
import { prisma } from "@/lib/db/client";
import { buildAgentResolver, normalizeName, resolveAgentByName } from "@/lib/agents/normalize";

const JOHN = 840001;
const JANE = 840002;
const ARABIC_ALIAS = "جون سميث";

const RANGE = { gte: 840000, lt: 840100 };

async function cleanup() {
  await prisma.agent.deleteMany({ where: { loginId: RANGE } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.agent.create({
    data: {
      loginId: JOHN,
      agentName: "John Smith",
      tlName: "TL",
      joinDate: new Date("2025-01-01"),
      aliases: { create: [{ alias: ARABIC_ALIAS }, { alias: "J. Smith" }] },
    },
  });
  await prisma.agent.create({
    data: { loginId: JANE, agentName: "Jane Doe", tlName: "TL", joinDate: new Date("2025-01-01") },
  });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("normalizeName", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeName("  John   Smith ")).toBe("John Smith");
  });
});

describe("agent resolver (§13)", () => {
  it("resolves canonical names, aliases, and whitespace/case variants", async () => {
    const resolver = await buildAgentResolver();

    expect(resolver.resolve("John Smith")?.loginId).toBe(JOHN);
    expect(resolver.resolve("  john   smith ")?.loginId).toBe(JOHN); // normalized + case-insensitive
    expect(resolver.resolve(ARABIC_ALIAS)?.loginId).toBe(JOHN); // Arabic alias
    expect(resolver.resolve("J. Smith")?.loginId).toBe(JOHN); // alternate spelling
    expect(resolver.resolve("Jane Doe")?.loginId).toBe(JANE);
  });

  it("returns null for unknown or empty names", async () => {
    const resolver = await buildAgentResolver();
    expect(resolver.resolve("Nobody Here")).toBeNull();
    expect(resolver.resolve("   ")).toBeNull();
  });

  it("resolveAgentByName works for a single lookup", async () => {
    expect((await resolveAgentByName(ARABIC_ALIAS))?.loginId).toBe(JOHN);
    expect(await resolveAgentByName("Unknown")).toBeNull();
  });
});
