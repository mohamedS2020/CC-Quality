/**
 * Thrown by the authorization guard. `status` maps straight to the HTTP
 * response: 401 when unauthenticated, 403 when authenticated but not permitted.
 * The guard throws before any protected data is read, so a denied request never
 * returns partial data (FR-10).
 */
export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
