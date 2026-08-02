import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { agentRepository } from "@/lib/db/repositories";
import { UserForm } from "../user-form";

export const dynamic = "force-dynamic";

const shell: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "2.5rem 1.5rem" };

export default async function NewUserPage() {
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

  const agents = (await agentRepository.list({ activeOnly: true })).map((a) => ({
    loginId: a.loginId,
    agentName: a.agentName,
  }));

  return (
    <main style={shell}>
      <Link href="/admin/users" style={{ color: "var(--accent, #2563eb)", fontSize: "0.9rem" }}>
        ← All users
      </Link>
      <h1 style={{ fontSize: "1.5rem", margin: "0.75rem 0 1.25rem" }}>New user</h1>
      <UserForm
        mode="create"
        agents={agents}
        initial={{ email: "", name: "", role: "MODERATOR", active: true, agentLoginId: null }}
      />
    </main>
  );
}
