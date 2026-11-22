/**
 * @jest-environment node
 *
 * User management (task 7): the Moderator permission toggle actually changes
 * capability (FR-8) and the AGENT⇄record link rule holds (FR-3). Self-contained:
 * upserts the permission catalog and uses a disjoint agent/email space.
 */
import { prisma } from "@/lib/db/client";
import { effectivePermissions, PERMISSIONS } from "@/lib/auth/permissions";
import { createUser, setUserPermissions, updateUser } from "@/lib/users/service";
import { userRepository } from "@/lib/db/repositories";

const AGENT_ID = 890001;
const AGENT_ID_2 = 890002; // a second agent — User.agentLoginId is unique (one agent ↔ one user)
const AGENT_ID_3 = 890003;
const AGENT_ID_4 = 890004;
const EMAIL_TAG = "@usermgmt.test";
const strongPassword = "Sup3rSecretPw!";

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { contains: EMAIL_TAG } } });
  await prisma.agent.deleteMany({ where: { loginId: { gte: 890000, lt: 890100 } } });
}

beforeAll(async () => {
  // Seed the permission catalog (idempotent) so grants resolve to real rows.
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: {},
      create: { key: p.key, label: p.label, description: p.description },
    });
  }
  await cleanup();
  await prisma.agent.createMany({
    data: [
      {
        loginId: AGENT_ID,
        agentName: "Link Agent",
        tlName: "TL",
        joinDate: new Date("2025-01-01"),
        email: `agent-good${EMAIL_TAG}`,
      },
      {
        loginId: AGENT_ID_2,
        agentName: "Move Agent",
        tlName: "TL",
        joinDate: new Date("2025-01-01"),
        email: `agent-move${EMAIL_TAG}`,
      },
      // No email yet: a login can't be created for this agent.
      {
        loginId: AGENT_ID_3,
        agentName: "No Email",
        tlName: "TL",
        joinDate: new Date("2025-01-01"),
      },
      {
        loginId: AGENT_ID_4,
        agentName: "Relink",
        tlName: "TL",
        joinDate: new Date("2025-01-01"),
        email: `relink${EMAIL_TAG}`,
      },
    ],
  });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("Moderator permission toggle (FR-8)", () => {
  it("granting then revoking a permission changes the Moderator's capability", async () => {
    const created = await createUser({
      email: `mod${EMAIL_TAG}`,
      name: "Mod",
      role: "MODERATOR",
      password: strongPassword,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // No grants → no capability.
    expect(await userRepository.getGrantedPermissionKeys(created.id)).toEqual([]);
    expect(effectivePermissions("MODERATOR", []).has("config.edit")).toBe(false);

    // Grant → capability appears (and only the granted one).
    await setUserPermissions(created.id, ["config.edit"]);
    const granted = await userRepository.getGrantedPermissionKeys(created.id);
    expect(granted).toEqual(["config.edit"]);
    const caps = effectivePermissions("MODERATOR", granted);
    expect(caps.has("config.edit")).toBe(true);
    expect(caps.has("users.manage")).toBe(false);

    // Revoke → capability gone.
    await setUserPermissions(created.id, []);
    expect(await userRepository.getGrantedPermissionKeys(created.id)).toEqual([]);
  });
});

describe("AGENT⇄record link rule (FR-3)", () => {
  it("requires an AGENT user to link to an existing agent", async () => {
    const noLink = await createUser({
      email: `agent-nolink${EMAIL_TAG}`,
      name: "No Link",
      role: "AGENT",
      password: strongPassword,
    });
    expect(noLink.ok).toBe(false);

    const badLink = await createUser({
      email: `agent-badlink${EMAIL_TAG}`,
      name: "Bad Link",
      role: "AGENT",
      password: strongPassword,
      agentLoginId: 899999,
    });
    expect(badLink.ok).toBe(false);

    const good = await createUser({
      email: `agent-good${EMAIL_TAG}`,
      name: "Good",
      role: "AGENT",
      password: strongPassword,
      agentLoginId: AGENT_ID,
    });
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    const saved = await userRepository.findById(good.id);
    expect(saved?.agentLoginId).toBe(AGENT_ID);
  });

  it("clears the link when a user moves away from the AGENT role", async () => {
    const created = await createUser({
      email: `agent-move${EMAIL_TAG}`,
      name: "Mover",
      role: "AGENT",
      password: strongPassword,
      agentLoginId: AGENT_ID_2,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updateUser(created.id, {
      name: "Mover",
      role: "MODERATOR",
      active: true,
      agentLoginId: AGENT_ID_2, // supplied, but must be dropped for a non-AGENT
    });
    expect(updated.ok).toBe(true);
    const saved = await userRepository.findById(created.id);
    expect(saved?.agentLoginId).toBeNull();
    expect(saved?.role).toBe("MODERATOR");
  });

  it("takes an Agent's login email from the agent, ignoring what was typed", async () => {
    const res = await createUser({
      email: "typed-something-else@example.com",
      name: "Inherit",
      role: "AGENT",
      password: strongPassword,
      agentLoginId: AGENT_ID_4,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect((await userRepository.findById(res.id))?.email).toBe(`relink${EMAIL_TAG}`);
    await prisma.user.delete({ where: { id: res.id } });
  });

  it("refuses an Agent login for an agent with no email", async () => {
    const res = await createUser({
      email: `noemail${EMAIL_TAG}`,
      name: "No Email",
      role: "AGENT",
      password: strongPassword,
      agentLoginId: AGENT_ID_3,
    });
    expect(res).toEqual({ ok: false, error: expect.stringContaining("Add an email") });
  });

  it("moves a user's login onto the agent's email when linked to that agent", async () => {
    const mod = await createUser({
      email: `was-moderator${EMAIL_TAG}`,
      name: "Was Mod",
      role: "MODERATOR",
      password: strongPassword,
    });
    expect(mod.ok).toBe(true);
    if (!mod.ok) return;
    const linked = await updateUser(mod.id, {
      name: "Was Mod",
      role: "AGENT",
      active: true,
      agentLoginId: AGENT_ID_4,
    });
    expect(linked.ok).toBe(true);
    const saved = await userRepository.findById(mod.id);
    expect(saved?.email).toBe(`relink${EMAIL_TAG}`);
    expect(saved?.agentLoginId).toBe(AGENT_ID_4);
  });

  it("rejects a weak password on create", async () => {
    const weak = await createUser({
      email: `weak${EMAIL_TAG}`,
      name: "Weak",
      role: "MODERATOR",
      password: "x",
    });
    expect(weak.ok).toBe(false);
  });
});
