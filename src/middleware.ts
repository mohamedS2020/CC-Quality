import { NextResponse, type NextRequest } from "next/server";
import { CURRENT_PATH_HEADER } from "@/lib/auth/next-path";

/**
 * Record the requested path + query on the request, so a page that finds the
 * visitor signed out can send them to /login?next=… and back again after.
 */
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(CURRENT_PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Pages and route handlers only — not build assets or images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
