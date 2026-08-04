import Link from "next/link";
import { getAuthContext } from "@/lib/auth";
import type { PermissionKey } from "@/lib/auth/permissions";

// Reads the session cookie, so render is dynamic.
export const dynamic = "force-dynamic";

type QuickAction = { href: string; title: string; description: string; permission: PermissionKey };

const ACTIONS: QuickAction[] = [
  {
    href: "/dashboard",
    title: "My scorecard",
    description: "Your section accuracy, rank, and training focus.",
    permission: "reports.view",
  },
  {
    href: "/reports",
    title: "Reports",
    description: "Section-vs-benchmark, agent comparison, and KPI trends.",
    permission: "reports.view",
  },
  {
    href: "/evaluations/new",
    title: "Score a call",
    description: "Open a fresh score sheet — the engine derives every figure.",
    permission: "evaluations.create",
  },
  {
    href: "/evaluations",
    title: "Evaluations",
    description: "Browse scored calls and their correction history.",
    permission: "evaluations.view",
  },
  {
    href: "/evaluations/import",
    title: "Import",
    description: "Bulk-load evaluations from a CSV or Excel export.",
    permission: "imports.run",
  },
  {
    href: "/admin/config",
    title: "Configuration",
    description: "View or edit the scorecard rubric, lenses, and policy.",
    permission: "config.view",
  },
  {
    href: "/admin/periods",
    title: "Periods",
    description: "Lock, review, and reopen scoring periods.",
    permission: "periods.lock",
  },
  {
    href: "/admin/agents",
    title: "Agents",
    description: "Maintain the agent roster and tenure.",
    permission: "agents.manage",
  },
  {
    href: "/admin/users",
    title: "Users",
    description: "Manage accounts, roles, and permissions.",
    permission: "users.manage",
  },
];

export default async function HomePage() {
  const ctx = await getAuthContext();

  if (!ctx) {
    return (
      <main className="auth-wrap">
        <div style={{ textAlign: "center", maxWidth: 440 }}>
          <span
            className="brand-mark"
            aria-hidden="true"
            style={{ margin: "0 auto", width: 56, height: 56, fontSize: "1.2rem" }}
          >
            CC
          </span>
          <h1 style={{ fontSize: "2rem", marginTop: "1.25rem" }}>CC-Quality</h1>
          <p className="muted" style={{ marginBottom: "1.75rem" }}>
            Call Center Quality Scoring System — QA Scorecard.
          </p>
          <Link href="/login" className="btn btn-primary">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const firstName = ctx.user.name.trim().split(/\s+/)[0];
  const actions = ACTIONS.filter((a) => ctx.permissions.has(a.permission));

  return (
    <main className="page">
      <h1 className="page-title" style={{ fontSize: "1.9rem" }}>
        Welcome back, {firstName}
      </h1>
      <p className="page-sub" style={{ marginBottom: "2rem" }}>
        Pick up where you left off, or use the sidebar to navigate.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "1rem",
        }}
      >
        {actions.map((a) => (
          <Link key={a.href} href={a.href} className="card card-interactive qa-card">
            <span className="qa-arrow" aria-hidden="true">
              →
            </span>
            <div style={{ fontWeight: 600, marginBottom: "0.3rem" }}>{a.title}</div>
            <div className="muted" style={{ fontSize: "0.9rem" }}>
              {a.description}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
