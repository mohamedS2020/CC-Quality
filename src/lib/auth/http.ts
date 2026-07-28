import "server-only";
import { NextResponse } from "next/server";
import { authorize } from "./index";
import type { AuthContext } from "./context";
import type { PermissionKey } from "./permissions";
import { AuthError } from "./errors";

/**
 * Wrap a route handler so it runs only for an authenticated (and, when
 * `permission` is given, permitted) caller. On denial it responds 401/403 with
 * just an error message and the handler never runs — so no protected data is
 * assembled or leaked (FR-10). Extra route args (e.g. dynamic params) are
 * forwarded to the handler unchanged.
 */
export function withPermission<Args extends unknown[]>(
  permission: PermissionKey | undefined,
  handler: (ctx: AuthContext, request: Request, ...args: Args) => Response | Promise<Response>,
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    let ctx: AuthContext;
    try {
      ctx = await authorize(permission);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
    return handler(ctx, request, ...args);
  };
}
