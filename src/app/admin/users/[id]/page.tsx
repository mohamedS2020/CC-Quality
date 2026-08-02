import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { agentRepository, userRepository } from "@/lib/db/repositories";
import { UserForm } from "../user-form";
import { PermissionEditor } from "../permission-editor";
import { ResetPasswordForm } from "../reset-password-form";

export const dynamic = "force-dynamic";

const shell: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "2.5rem 1.5rem" };
const hr: React.CSSProperties = {
  border: 0,
  borderTop: "1px solid var(--border)",
  margin: "2rem 0",
};

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const userId = Number(id);
  const user = Number.isInteger(userId) ? await userRepository.findById(userId) : null;
  if (!user) notFound();

  const [agents, grantedKeys] = await Promise.all([
    agentRepository.list({ activeOnly: true }),
    userRepository.getGrantedPermissionKeys(user.id),
  ]);

  return (
    <main style={shell}>
      <Link href="/admin/users" style={{ color: "var(--accent, #2563eb)", fontSize: "0.9rem" }}>
        ← All users
      </Link>
      <h1 style={{ fontSize: "1.5rem", margin: "0.75rem 0 0.25rem" }}>{user.name}</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.25rem" }}>{user.email}</p>

      <UserForm
        mode="edit"
        userId={user.id}
        agents={agents.map((a) => ({ loginId: a.loginId, agentName: a.agentName }))}
        initial={{
          email: user.email,
          name: user.name,
          role: user.role,
          active: user.active,
          agentLoginId: user.agentLoginId,
        }}
      />

      {user.role === "MODERATOR" && (
        <>
          <hr style={hr} />
          <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Permissions</h2>
          <PermissionEditor userId={user.id} initialKeys={grantedKeys} />
        </>
      )}

      <hr style={hr} />
      <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Reset password</h2>
      <ResetPasswordForm userId={user.id} />
    </main>
  );
}
