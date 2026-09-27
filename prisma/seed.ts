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

/**
 * The evaluation form's Call type dropdown options. These live in the
 * non-versioned `Setting` store (editing them must never mint a config
 * version), so they are seeded here rather than in the baseline config.
 *
 * Alphabetical, which is the order the dropdown shows them in. Admins can edit
 * the list in Configuration → Operational settings; re-seeding never overwrites
 * their edits.
 */
const CALL_TYPES = [
  "Access Permission",
  "Business proposal Request",
  "Cancellation Request",
  "Careers Inquire",
  "Cheque Inquire",
  "Client's Data update",
  "Community Request",
  "Construction Phase",
  "Contract Inquiry",
  "Dropped Call",
  "EOI Request",
  "Facility Request",
  "Financial Inquiry",
  "General inquiry",
  "Guest Entry Request",
  "Inheritance",
  "Insurance Deposit",
  "Legal Request",
  "Maintenance Deposit",
  "Meeting Reservation",
  "Mob.Application",
  "Modification Request",
  "Not related",
  "NPS",
  "Other",
  "Project Update informations",
  "Relinquishment Request",
  "Resale Request",
  "Sales Lead Request",
  "Season Operation",
  "Security Request",
  "Silent Call",
  "Site tour Request",
  "Snag List",
  "Survey Task",
  "Unit Handover Date",
  "Unit Handover Phase",
  "Unit Relocation",
  "Unit Transfer",
  "Unit Upgrade",
  "Work Permits Request",
  "Wrong number",
];

/**
 * Seed the Call type options. Idempotent and non-destructive: if the setting
 * already exists it is left exactly as the admin edited it.
 */
async function seedCallTypes(): Promise<{ created: boolean; count: number }> {
  const existing = await prisma.setting.findUnique({ where: { key: "call_types" } });
  if (existing) {
    const value = existing.value;
    return { created: false, count: Array.isArray(value) ? value.length : 0 };
  }
  await prisma.setting.create({ data: { key: "call_types", value: CALL_TYPES } });
  return { created: true, count: CALL_TYPES.length };
}

async function main() {
  const agents = await seedDemoAgents();
  const permissions = await seedPermissions();
  const admin = await seedAdminUser();
  const config = await seedBaselineConfig();
  const callTypes = await seedCallTypes();
  console.log(`✔ Seed complete — ${agents} demo agents, ${permissions} permissions upserted.`);
  console.log(
    callTypes.created
      ? `✔ Call types seeded (${callTypes.count} options).`
      : `• Call types already present (${callTypes.count}) — left unchanged.`,
  );
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
