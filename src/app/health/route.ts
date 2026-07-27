import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// Health checks must never be cached and must run on the Node.js runtime
// (Prisma is not supported on the Edge runtime).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /health — confirms the app is running and the database is reachable.
 * Returns 200 with { status: "ok", db: "connected" } on success,
 * or 503 with { status: "error", db: "disconnected" } if the DB query fails.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        db: "disconnected",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
