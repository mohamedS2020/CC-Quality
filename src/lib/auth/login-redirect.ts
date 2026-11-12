import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CURRENT_PATH_HEADER, loginUrl } from "./next-path";

/**
 * Send a signed-out visitor to the login page, remembering the page they asked
 * for (set on the request by `src/middleware.ts`) so they land back on it.
 */
export async function redirectToLogin(): Promise<never> {
  redirect(loginUrl((await headers()).get(CURRENT_PATH_HEADER)));
}
