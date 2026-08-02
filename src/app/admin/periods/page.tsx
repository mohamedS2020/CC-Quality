import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { listPeriods } from "@/lib/periods/period";
import { PeriodsManager, type PeriodRow } from "./periods-manager";

// Reads the session + live period list, so this route is always dynamic.
export const dynamic = "force-dynamic";

const shell: React.CSSProperties = { maxWidth: 900, margin: "0 auto", padding: "2.5rem 1.5rem" };

export default async function PeriodsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (!ctx.permissions.has("periods.lock")) {
    return (
      <main style={shell}>
        <h1 style={{ fontSize: "1.4rem" }}>403 — Forbidden</h1>
        <p style={{ color: "var(--muted)" }}>You need the “Lock periods” permission.</p>
      </main>
    );
  }

  const periods = await listPeriods();
  const rows: PeriodRow[] = periods.map((p) => ({
    id: p.id,
    type: p.type,
    label: p.label,
    status: p.status,
    evaluations: p._count.evaluations,
    lockedAt: p.lockedAt ? p.lockedAt.toISOString() : null,
  }));

  return (
    <main style={shell}>
      <PeriodsManager initialPeriods={rows} />
    </main>
  );
}
