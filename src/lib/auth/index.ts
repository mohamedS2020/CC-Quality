import "server-only";
import { cache } from "react";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { userRepository } from "@/lib/db/repositories/userRepository";
import { hashPassword, verifyPassword } from "./password";
import { createSession, hashToken, invalidateSession, validateSessionToken } from "./session";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "./cookies";
import { effectivePermissions, type PermissionKey } from "./permissions";
import { checkAuthorization, type AuthContext, type PublicUser } from "./context";

export type LoginResult = { ok: true; user: PublicUser } | { ok: false; error: string };

function toPublicUser(user: User): PublicUser {
  const { passwordHash, ...rest } = user;
  void passwordHash;
  return rest;
}

// Lazily-computed argon2 hash used to equalize verify timing when no user is
// found, so response timing doesn't reveal which emails exist.
let decoyHash: Promise<string> | null = null;
function timingDecoyHash(): Promise<string> {
  decoyHash ??= hashPassword("timing-decoy");
  return decoyHash;
}

/**
 * Verify credentials, open a session, and set the cookie (FR-1). Returns a
 * single generic error for unknown email, wrong password, and inactive account
 * alike, so callers can't distinguish them.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const error = "Invalid email or password.";
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  if (!user) {
    await verifyPassword(await timingDecoyHash(), password).catch(() => false);
    return { ok: false, error };
  }

  const valid = await verifyPassword(user.passwordHash, password).catch(() => false);
  if (!valid || !user.active) return { ok: false, error };

  const { token } = await createSession(user.id);
  await setSessionCookie(token);
  return { ok: true, user: toPublicUser(user) };
}

/** Destroy the current session and clear the cookie (FR-4). */
export async function logout(): Promise<void> {
  const token = await readSessionToken();
  if (token) await invalidateSession(hashToken(token));
  await clearSessionCookie();
}

/**
 * The current authenticated user, or null. Memoized per request via React
 * `cache` so multiple server components resolve it with a single validation.
 */
export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  const { user } = await validateSessionToken(token);
  return user ? toPublicUser(user) : null;
});

/**
 * The current caller's identity + effective permissions, or null if not signed
 * in. Memoized per request. Admin/Agent sets derive from role (FR-6/9);
 * Moderator grants are loaded from the DB (FR-8).
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const grantedKeys =
    user.role === "MODERATOR" ? await userRepository.getGrantedPermissionKeys(user.id) : [];
  return { user, permissions: effectivePermissions(user.role, grantedKeys) };
});

/**
 * Server-side authorization guard (FR-10). Call at the top of every protected
 * API route / server action. Throws AuthError (401/403) before any protected
 * data is read, so a denied request never returns partial data.
 */
export async function authorize(permission?: PermissionKey): Promise<AuthContext> {
  return checkAuthorization(await getAuthContext(), permission);
}

export { hashPassword, verifyPassword } from "./password";
export { invalidateUserSessions } from "./session";
export { validatePassword, MIN_PASSWORD_LENGTH } from "./policy";
export { resetPassword, type PasswordUpdateResult } from "./account";
export { AuthError } from "./errors";
export { checkAuthorization, type AuthContext, type PublicUser } from "./context";
export type { PermissionKey } from "./permissions";
export { agentScopeFor, evaluationScopeWhere, agentScopeWhere, type AgentScope } from "./scope";
