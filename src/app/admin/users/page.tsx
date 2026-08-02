import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { userRepository } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

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
      <main className="page page-narrow">
        <h1 className="page-title">403 — Forbidden</h1>
        <p className="page-sub">You need the “Manage users” permission.</p>
      </main>
    );
  }

  const users = await userRepository.list();

  return (
    <main className="page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "1rem",
        }}
      >
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-sub">
            Admins, Moderators, and Agents. Moderator privileges are granted per-user.
          </p>
        </div>
        <Link href="/admin/users/new" className="btn btn-primary">
          + New user
        </Link>
      </div>

      <div className="card" style={{ marginTop: "1.5rem", padding: "0.5rem 0.75rem" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Linked agent</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td className="muted">{u.email}</td>
                <td>{ROLE_LABEL[u.role] ?? u.role}</td>
                <td>{u.agent ? `${u.agent.agentName} (${u.agent.loginId})` : "—"}</td>
                <td>
                  {u.active ? (
                    <span className="badge badge-success">Active</span>
                  ) : (
                    <span className="badge">Inactive</span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <Link href={`/admin/users/${u.id}`}>Edit →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
