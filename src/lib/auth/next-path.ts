/**
 * Where to send someone after they sign in (pure, shared by the login page,
 * its action, and the redirect helper).
 */

/** Request header the middleware fills with the current path + query. */
export const CURRENT_PATH_HEADER = "x-current-path";

/**
 * Accept only a same-site path ("/reports?period=2025-11"); anything else —
 * absolute or protocol-relative URLs, backslash tricks, the login page itself —
 * falls back to the home page, so `?next=` can't be used as an open redirect.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  if (raw === "/login" || raw.startsWith("/login?") || raw.startsWith("/login/")) return "/";
  return raw;
}

/** "/login", carrying the page to come back to when there is one. */
export function loginUrl(next: string | null | undefined): string {
  const path = safeNextPath(next);
  return path === "/" ? "/login" : `/login?next=${encodeURIComponent(path)}`;
}
