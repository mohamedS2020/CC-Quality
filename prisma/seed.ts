import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Development seed — idempotent (safe to re-run).
 *
 * Populates local data for development only. Real production data is loaded via
 * the migration workstream (task 10.0), NOT here.
 *
 * Later tasks extend this file:
 *   - Permission catalog (task 3.3)
 *   - Verified baseline ScorecardConfig v1 from Appendix B/D (task 4.9)
 */

async function seedDemoAgents(): Promise<number> {
  const demoAgents = [
    {
      loginId: 900001,
      agentName: "Demo Agent One",
      tlName: "Demo Team Leader",
      joinDate: new Date("2025-01-15"),
    },
    {
      loginId: 900002,
      agentName: "Demo Agent Two",
      tlName: "Demo Team Leader",
      joinDate: new Date("2025-06-02"),
    },
  ];

  for (const agent of demoAgents) {
    await prisma.agent.upsert({
      where: { loginId: agent.loginId },
      update: {
        agentName: agent.agentName,
        tlName: agent.tlName,
        joinDate: agent.joinDate,
      },
      create: agent,
    });
  }
  return demoAgents.length;
}

async function main() {
  const agents = await seedDemoAgents();
  console.log(`✔ Seed complete — ${agents} demo agents upserted.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("✖ Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
