import { PrismaClient } from "@prisma/client";
// Imported from the modules directly (not "@/lib/auth") so this standalone
// script never pulls in the server-only auth barrel.
import { hashPassword } from "../src/lib/auth/password";
import { PERMISSIONS } from "../src/lib/auth/permissions";
import { baselineConfigInput } from "../src/lib/config/baseline";
import { createConfigVersion } from "../src/lib/config/versioning";

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

/**
 * Bootstrap admin (FR-1: no public self-registration — the first account must
 * be seeded). Idempotent: an existing admin is left untouched (we never reset a
 * real password on re-seed). Credentials are dev defaults; override with
 * SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD, and change them in any real deploy.
 */
async function seedAdminUser(): Promise<{ email: string; created: boolean }> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@cc-quality.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { email, created: false };

  await prisma.user.create({
    data: {
      email,
      name: "Bootstrap Admin",
      role: "ADMIN",
      passwordHash: await hashPassword(password),
    },
  });
  return { email, created: true };
}

/** Seed the permission catalog (FR-7) into the Permission table. Idempotent. */
async function seedPermissions(): Promise<number> {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { label: permission.label, description: permission.description },
      create: {
        key: permission.key,
        label: permission.label,
        description: permission.description,
      },
    });
  }
  return PERMISSIONS.length;
}

/**
 * Seed the verified baseline config as version 1 (FR-28). Idempotent: skipped if
 * any config version already exists, so it never overwrites edited config.
 */
async function seedBaselineConfig(): Promise<{ created: boolean; version?: number }> {
  if ((await prisma.scorecardConfig.count()) > 0) return { created: false };
  const { version } = await createConfigVersion(baselineConfigInput, { activate: true });
  return { created: true, version };
}

async function main() {
  const agents = await seedDemoAgents();
  const permissions = await seedPermissions();
  const admin = await seedAdminUser();
  const config = await seedBaselineConfig();
  console.log(`✔ Seed complete — ${agents} demo agents, ${permissions} permissions upserted.`);
  console.log(
    config.created
      ? `✔ Baseline config seeded as version ${config.version} (active).`
      : "• Config already present — baseline left unchanged.",
  );
  console.log(
    admin.created
      ? `✔ Bootstrap admin created: ${admin.email} (dev password "ChangeMe123!" — change it).`
      : `• Admin ${admin.email} already exists — left unchanged.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("✖ Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
