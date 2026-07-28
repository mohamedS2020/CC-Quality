import { NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/http";

// Prisma-backed session lookup -> Node runtime, never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/me — the caller's identity and effective permission keys. Requires
 * authentication (no specific permission); an anonymous request gets 401 with
 * no user data, demonstrating the guard (FR-10).
 */
export const GET = withPermission(undefined, ({ user, permissions }) => {
  return NextResponse.json({ user, permissions: [...permissions] });
});
