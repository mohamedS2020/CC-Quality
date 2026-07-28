import { prisma } from "@/lib/db/client";
import { hashPassword } from "./password";
import { validatePassword } from "./policy";
import { invalidateUserSessions } from "./session";

/**
 * Account/password operations that don't touch the request (no cookies), kept
 * out of the server-only auth barrel so they're directly unit-testable and
 * reusable from server actions and the standalone scripts.
 */

export type PasswordUpdateResult = { ok: true } | { ok: false; error: string };

/**
 * Admin-initiated password reset (FR-1): set a new password for `userId` and
 * invalidate all of that user's sessions, forcing any active logins to
 * re-authenticate. There is no public self-registration or self-service reset;
 * authorization (only Admins / permitted users may call this) is enforced by
 * the guard in task 3.4 — this is the underlying capability.
 */
export async function resetPassword(
  userId: number,
  newPassword: string,
): Promise<PasswordUpdateResult> {
  const check = validatePassword(newPassword);
  if (!check.ok) return check;

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await invalidateUserSessions(userId);
  return { ok: true };
}
