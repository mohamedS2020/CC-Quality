import Link from "next/link";
import { getAuthContext, redirectToLogin } from "@/lib/auth";
import { AgentForm } from "../agent-form";

export const dynamic = "force-dynamic";

export default async function NewAgentPage() {
  const ctx = await getAuthContext();
  if (!ctx) return redirectToLogin();

  if (!ctx.permissions.has("agents.manage")) {
    return (
      <main className="page page-narrow">
        <h1 className="page-title">403 — Forbidden</h1>
        <p className="page-sub">You need the “Manage agents” permission.</p>
      </main>
    );
  }

  return (
    <main className="page page-narrow">
      <Link prefetch={false} href="/admin/agents" style={{ fontSize: "0.9rem" }}>
        ← All agents
      </Link>
      <h1 className="page-title" style={{ margin: "0.75rem 0 1.25rem" }}>
        New agent
      </h1>
      <AgentForm
        mode="create"
        initial={{ loginId: null, agentName: "", tlName: "", joinDate: "", active: true }}
      />
    </main>
  );
}
