import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { listPeriods } from "@/lib/periods/period";
import { PeriodsManager, type PeriodRow } from "./periods-manager";

// Reads the session + live period list, so this route is always dynamic.
export const dynamic = "force-dynamic";

export default async function PeriodsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (!ctx.permissions.has("periods.lock")) {
    return (
      <main className="page page-narrow">
        <h1 className="page-title">403 — Forbidden</h1>
        <p className="page-sub">You need the “Lock periods” permission.</p>
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
    <main className="page">
      <PeriodsManager initialPeriods={rows} />
    </main>
  );
}
