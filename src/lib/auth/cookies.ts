import { cookies, headers } from "next/headers";
import { SESSION_COOKIE_NAME } from "./config";

/**
 * Whether the current request arrived over HTTPS. We must NOT hardcode `secure`
 * to `NODE_ENV`: a production build served over plain HTTP (e.g. `next start` on
 * a LAN address or any non-localhost origin) would then set a `Secure` cookie
 * the browser refuses to store — the session appears to work on the login render
 * but is dropped on the next navigation. Deriving it from the request keeps the
 * cookie storable over HTTP and `Secure` behind an HTTPS proxy.
 */
async function requestIsHttps(): Promise<boolean> {
  const proto = (await headers()).get("x-forwarded-proto");
  return proto?.split(",")[0]?.trim() === "https";
}

async function cookieOptions() {
  return {
    httpOnly: true,
    secure: await requestIsHttps(),
    sameSite: "lax" as const,
    path: "/",
  };
}

/**
 * Set the session cookie as a *session-scoped* cookie (no maxAge → cleared when
 * the browser closes). The DB session's `expiresAt` is the authoritative idle
 * deadline (FR-5); active reads extend it server-side, so we don't rely on the
 * cookie's own lifetime for expiry.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, await cookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", { ...(await cookieOptions()), maxAge: 0 });
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}
