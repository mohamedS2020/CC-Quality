import {
  AGENT_PERMISSIONS,
  ALL_PERMISSION_KEYS,
  effectivePermissions,
  hasPermission,
  type PermissionKey,
} from "@/lib/auth/permissions";

/**
 * The full role × permission matrix (FR-6/7/9): Admin holds everything, Agent
 * holds a fixed self-scope set, Moderator holds exactly what it is granted.
 */
describe("permission matrix (role × permission)", () => {
  it("ADMIN holds every permission implicitly", () => {
    for (const key of ALL_PERMISSION_KEYS) {
      expect(hasPermission("ADMIN", [], key)).toBe(true);
    }
    expect(effectivePermissions("ADMIN").size).toBe(ALL_PERMISSION_KEYS.length);
  });

  it("AGENT holds exactly the fixed self-scope set and nothing else", () => {
    for (const key of ALL_PERMISSION_KEYS) {
      expect(hasPermission("AGENT", [], key)).toBe(AGENT_PERMISSIONS.includes(key));
    }
    expect([...effectivePermissions("AGENT")].sort()).toEqual([...AGENT_PERMISSIONS].sort());
  });

  it("MODERATOR holds exactly its granted keys across the whole catalog", () => {
    const granted: PermissionKey[] = ["config.view", "reports.view"];
    for (const key of ALL_PERMISSION_KEYS) {
      expect(hasPermission("MODERATOR", granted, key)).toBe(granted.includes(key));
    }
  });

  it("MODERATOR with no grants holds nothing", () => {
    expect(effectivePermissions("MODERATOR", []).size).toBe(0);
    for (const key of ALL_PERMISSION_KEYS) {
      expect(hasPermission("MODERATOR", [], key)).toBe(false);
    }
  });

  it("ignores unknown/invalid granted keys for a MODERATOR", () => {
    expect(effectivePermissions("MODERATOR", ["not.a.real.key", "config.edit"])).toEqual(
      new Set(["config.edit"]),
    );
  });

  it("keeps the agent self-scope set within the catalog", () => {
    for (const key of AGENT_PERMISSIONS) {
      expect(ALL_PERMISSION_KEYS).toContain(key);
    }
  });
});
