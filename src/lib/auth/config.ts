/** Name of the HttpOnly cookie carrying the raw session token. */
export const SESSION_COOKIE_NAME = "cc_session";

/**
 * Sliding inactivity window (FR-5): a session with no activity for this long
 * expires; activity within the window extends it. Tunable via the
 * SESSION_IDLE_MINUTES env var; defaults to 30 minutes.
 */
const idleMinutes = Number(process.env.SESSION_IDLE_MINUTES);
export const SESSION_IDLE_MS =
  (Number.isFinite(idleMinutes) && idleMinutes > 0 ? idleMinutes : 30) * 60 * 1000;
