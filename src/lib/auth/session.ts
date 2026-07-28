import { createHash, randomBytes } from "node:crypto";
import type { Session, User } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { SESSION_IDLE_MS } from "./config";

/** A URL-safe random token — the raw value stored in the cookie (never in the DB). */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 of the raw token; this hash is the Session `id` we persist, so a DB
 *  leak yields no usable tokens. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Create a session for a user and return the raw token to put in the cookie. */
export async function createSession(userId: number): Promise<{ token: string; session: Session }> {
  const token = generateSessionToken();
  const now = new Date();
  const session = await prisma.session.create({
    data: {
      id: hashToken(token),
      userId,
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + SESSION_IDLE_MS),
    },
  });
  return { token, session };
}

export async function invalidateSession(id: string): Promise<void> {
  // Ignore "record not found" — the desired end state (no session) already holds.
  await prisma.session.delete({ where: { id } }).catch(() => undefined);
}

/** Kill every session for a user — used on logout-everywhere and admin deactivation. */
export async function invalidateUserSessions(userId: number): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export type SessionValidationResult =
  { session: Session; user: User } | { session: null; user: null };

/**
 * Validate a raw cookie token and enforce sliding inactivity expiry (FR-5):
 *  - unknown token or idle-expired session -> null (and the row is removed);
 *  - a deactivated account -> null (its sessions are invalid immediately);
 *  - otherwise the session is returned, and its expiry is extended. The write
 *    is throttled to the second half of the window so ordinary reads don't
 *    write on every request.
 */
export async function validateSessionToken(token: string): Promise<SessionValidationResult> {
  const id = hashToken(token);
  const found = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!found) return { session: null, user: null };

  const now = new Date();
  if (now >= found.expiresAt || !found.user.active) {
    await invalidateSession(id);
    return { session: null, user: null };
  }

  const halfway = found.expiresAt.getTime() - SESSION_IDLE_MS / 2;
  const record =
    now.getTime() >= halfway
      ? await prisma.session.update({
          where: { id },
          data: { expiresAt: new Date(now.getTime() + SESSION_IDLE_MS), lastActivityAt: now },
          include: { user: true },
        })
      : found;

  const { user, ...session } = record;
  return { session, user };
}
