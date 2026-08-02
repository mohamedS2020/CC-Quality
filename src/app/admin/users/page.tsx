import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { userRepository } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

const shell: React.CSSProperties = { maxWidth: 1000, margin: "0 auto", padding: "2.5rem 1.5rem" };
const cell: React.CSSProperties = {
  padding: "0.6rem 0.5rem",
  borderBottom: "1px solid var(--border)",
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  MODERATOR: "Moderator",
  AGENT: "Agent",
};

export default async function UsersPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (!ctx.permissions.has("users.manage")) {
    return (
      <main style={shell}>
        <h1 style={{ fontSize: "1.4rem" }}>403 — Forbidden</h1>
        <p style={{ color: "var(--muted)" }}>You need the “Manage users” permission.</p>
      </main>
    );
  }

  const users = await userRepository.list();

  return (
    <main style={shell}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Users</h1>
        <Link href="/admin/users/new" style={{ color: "var(--accent, #2563eb)" }}>
          + New user
        </Link>
      </div>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Admins, Moderators, and Agents. Moderator privileges are granted per-user; Agent users are
        linked to an agent record and limited to their own data.
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted)" }}>
            <th style={cell}>Name</th>
            <th style={cell}>Email</th>
            <th style={cell}>Role</th>
            <th style={cell}>Linked agent</th>
            <th style={cell}>Status</th>
            <th style={cell}></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td style={cell}>{u.name}</td>
              <td style={cell}>{u.email}</td>
              <td style={cell}>{ROLE_LABEL[u.role] ?? u.role}</td>
              <td style={cell}>{u.agent ? `${u.agent.agentName} (${u.agent.loginId})` : "—"}</td>
              <td style={cell}>
                {u.active ? "Active" : <span style={{ color: "var(--muted)" }}>Inactive</span>}
              </td>
              <td style={cell}>
                <Link href={`/admin/users/${u.id}`} style={{ color: "var(--accent, #2563eb)" }}>
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
