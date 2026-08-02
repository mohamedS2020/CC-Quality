import Link from "next/link";
import { getAuthContext } from "@/lib/auth";
import type { PermissionKey } from "@/lib/auth/permissions";

// Reads the session cookie, so render is dynamic.
export const dynamic = "force-dynamic";

type QuickAction = { href: string; title: string; description: string; permission: PermissionKey };

const ACTIONS: QuickAction[] = [
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
    description: "Edit the scorecard rubric, lenses, and policy.",
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

const wrap: React.CSSProperties = { maxWidth: 960, margin: "0 auto", padding: "3rem 1.5rem" };

const card: React.CSSProperties = {
  display: "block",
  padding: "1.1rem 1.2rem",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "inherit",
  textDecoration: "none",
};

export default async function HomePage() {
  const ctx = await getAuthContext();

  if (!ctx) {
    return (
      <main
        style={{ maxWidth: 460, margin: "0 auto", padding: "6rem 1.5rem", textAlign: "center" }}
      >
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>CC-Quality</h1>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
          Call Center Quality Scoring System — QA Scorecard.
        </p>
        <Link
          href="/login"
          style={{
            display: "inline-block",
            padding: "0.6rem 1.4rem",
            borderRadius: 8,
            background: "var(--primary)",
            color: "#fff",
          }}
        >
          Sign in
        </Link>
      </main>
    );
  }

  const firstName = ctx.user.name.trim().split(/\s+/)[0];
  const actions = ACTIONS.filter((a) => ctx.permissions.has(a.permission));

  return (
    <main style={wrap}>
      <h1 style={{ fontSize: "1.9rem", marginBottom: "0.25rem" }}>Welcome, {firstName}</h1>
      <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
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
          <Link key={a.href} href={a.href} style={card}>
            <div style={{ fontWeight: 600, marginBottom: "0.3rem" }}>{a.title}</div>
            <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{a.description}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
