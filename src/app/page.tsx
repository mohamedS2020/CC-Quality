import Link from "next/link";
import { getAuthContext } from "@/lib/auth";
import type { PermissionKey } from "@/lib/auth/permissions";
import { logoutAction } from "./login/actions";

// Reads the session cookie, so render is dynamic.
export const dynamic = "force-dynamic";

const NAV: { href: string; label: string; permission: PermissionKey }[] = [
  { href: "/evaluations", label: "Evaluations", permission: "evaluations.view" },
  { href: "/evaluations/new", label: "New score sheet", permission: "evaluations.create" },
  { href: "/evaluations/import", label: "Import", permission: "imports.run" },
  { href: "/admin/config", label: "Configuration", permission: "config.view" },
  { href: "/admin/periods", label: "Periods", permission: "periods.lock" },
  { href: "/admin/agents", label: "Agents", permission: "agents.manage" },
  { href: "/admin/users", label: "Users", permission: "users.manage" },
];

const link: React.CSSProperties = {
  display: "block",
  padding: "0.6rem 0.9rem",
  borderRadius: 8,
  border: "1px solid var(--border, #ccc)",
  color: "inherit",
  textDecoration: "none",
};

export default async function HomePage() {
  const ctx = await getAuthContext();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>CC-Quality</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Call Center Quality Scoring System — QA Scorecard.
      </p>

      {ctx ? (
        <>
          <div style={{ marginBottom: "1.5rem" }}>
            <p style={{ marginBottom: "0.75rem" }}>
              Signed in as <strong>{ctx.user.email}</strong> ({ctx.user.role}).
            </p>
            <form action={logoutAction}>
              <button
                type="submit"
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: 6,
                  border: "1px solid var(--border, #ccc)",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                Sign out
              </button>
            </form>
          </div>

          <nav
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "0.6rem",
              marginBottom: "1.5rem",
            }}
          >
            {NAV.filter((item) => ctx.permissions.has(item.permission)).map((item) => (
              <Link key={item.href} href={item.href} style={link}>
                {item.label}
              </Link>
            ))}
          </nav>
        </>
      ) : (
        <p style={{ marginBottom: "1.5rem" }}>
          <a href="/login">Sign in</a>
        </p>
      )}

      <p>
        System health: <a href="/health">/health</a>
      </p>
    </main>
  );
}
