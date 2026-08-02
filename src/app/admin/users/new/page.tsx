import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { agentRepository } from "@/lib/db/repositories";
import { UserForm } from "../user-form";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
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

  const agents = (await agentRepository.list({ activeOnly: true })).map((a) => ({
    loginId: a.loginId,
    agentName: a.agentName,
  }));

  return (
    <main className="page page-narrow">
      <Link href="/admin/users" style={{ fontSize: "0.9rem" }}>
        ← All users
      </Link>
      <h1 className="page-title" style={{ margin: "0.75rem 0 1.25rem" }}>
        New user
      </h1>
      <UserForm
        mode="create"
        agents={agents}
        initial={{ email: "", name: "", role: "MODERATOR", active: true, agentLoginId: null }}
      />
    </main>
  );
}
