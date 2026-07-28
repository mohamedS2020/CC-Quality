import type { User } from "@prisma/client";
import type { PermissionKey } from "./permissions";
import { AuthError } from "./errors";

/**
 * Pure authorization types + check, deliberately free of session/DB/server-only
 * concerns so they can be unit-tested directly and reused on either side of the
 * network boundary. The session-bound guard (`authorize`) lives in the
 * server-only barrel and delegates the actual decision here.
 */

/** A user safe to expose to callers — never carries the password hash. */
export type PublicUser = Omit<User, "passwordHash">;

/** The resolved caller: their identity plus their effective permission set. */
export type AuthContext = { user: PublicUser; permissions: Set<PermissionKey> };

/**
 * Decide access for an already-resolved context: throws 401 when there is no
 * signed-in user, 403 when a required `permission` is missing, otherwise
 * returns the context unchanged.
 */
export function checkAuthorization(
  ctx: AuthContext | null,
  permission?: PermissionKey,
): AuthContext {
  if (!ctx) throw new AuthError(401, "Authentication required.");
  if (permission && !ctx.permissions.has(permission)) {
    throw new AuthError(403, "You do not have permission to perform this action.");
  }
  return ctx;
}
