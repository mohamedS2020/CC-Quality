import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "./config";

const baseOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/**
 * Set the session cookie as a *session-scoped* cookie (no maxAge → cleared when
 * the browser closes). The DB session's `expiresAt` is the authoritative idle
 * deadline (FR-5); active reads extend it server-side, so we don't rely on the
 * cookie's own lifetime for expiry.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, baseOptions);
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", { ...baseOptions, maxAge: 0 });
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}
