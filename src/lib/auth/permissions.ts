import type { UserRole } from "@prisma/client";

/**
 * The permission catalog (FR-7) — the single source of truth for what a
 * Moderator's privileges can be toggled to. Defined as config-driven constants
 * here and seeded into the `Permission` table (so the admin UI and grants
 * reference real rows), rather than hardcoded at each call site.
 *
 * This module is intentionally pure (no DB, no server-only): the client-side
 * session hook (task 3.6) reuses `hasPermission` to hide/disable controls.
 * The authoritative check is always server-side (task 3.4).
 *
 * Role model (FR-6/9):
 *   - ADMIN     → every permission, implicitly (never stored as grants).
 *   - AGENT     → a fixed self-scope set; data is further limited to their own
 *                 login_id by the self-scoping layer (task 3.5).
 *   - MODERATOR → exactly the permissions granted via UserPermission.
 */
export const PERMISSIONS = [
  {
    key: "evaluations.create",
    label: "Create evaluations",
    description: "Score calls and create new evaluation records.",
  },
  {
    key: "evaluations.edit",
    label: "Edit evaluations",
    description: "Edit or post corrections to existing evaluations.",
  },
  {
    key: "evaluations.view",
    label: "View evaluations",
    description: "View evaluation records and their scores.",
  },
  {
    key: "agents.manage",
    label: "Manage agents",
    description: "Create, edit, and deactivate agent records.",
  },
  {
    key: "users.manage",
    label: "Manage users",
    description: "Create and edit users, grant permissions, and reset passwords.",
  },
  {
    key: "config.view",
    label: "View configuration",
    description: "View the scorecard configuration and rubric.",
  },
  {
    key: "config.edit",
    label: "Edit configuration",
    description: "Edit the scorecard configuration, creating a new version.",
  },
  {
    key: "dictionary.edit",
    label: "Edit dictionary",
    description: "Edit the error dictionary (severities, definitions, training buckets).",
  },
  {
    key: "imports.run",
    label: "Run imports",
    description: "Import evaluation data from source files.",
  },
  {
    key: "reports.view",
    label: "View reports",
    description: "View dashboards and reports.",
  },
  {
    key: "reports.export",
    label: "Export reports",
    description: "Export reports and their underlying data.",
  },
  {
    key: "periods.lock",
    label: "Lock periods",
    description: "Lock and reopen scoring periods.",
  },
] as const;

/** Union of every valid permission key, derived from the catalog above. */
export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = PERMISSIONS.map((p) => p.key);

/** The fixed self-scope permissions an AGENT always has (FR-9). */
export const AGENT_PERMISSIONS: readonly PermissionKey[] = ["evaluations.view", "reports.view"];

export function isPermissionKey(value: string): value is PermissionKey {
  return (ALL_PERMISSION_KEYS as readonly string[]).includes(value);
}

/**
 * The effective permission set for a user, given their role and (for
 * Moderators) their granted permission keys.
 */
export function effectivePermissions(
  role: UserRole,
  grantedKeys: readonly string[] = [],
): Set<PermissionKey> {
  switch (role) {
    case "ADMIN":
      return new Set(ALL_PERMISSION_KEYS);
    case "AGENT":
      return new Set(AGENT_PERMISSIONS);
    case "MODERATOR":
      return new Set(grantedKeys.filter(isPermissionKey));
  }
}

/** Whether a user with `role` (+ granted keys for Moderators) holds `key`. */
export function hasPermission(
  role: UserRole,
  grantedKeys: readonly string[],
  key: PermissionKey,
): boolean {
  if (role === "ADMIN") return true;
  if (role === "AGENT") return AGENT_PERMISSIONS.includes(key);
  return grantedKeys.includes(key);
}
