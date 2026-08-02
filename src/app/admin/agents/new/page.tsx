import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { AgentForm } from "../agent-form";

export const dynamic = "force-dynamic";

const shell: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "2.5rem 1.5rem" };

export default async function NewAgentPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (!ctx.permissions.has("agents.manage")) {
    return (
      <main style={shell}>
        <h1 style={{ fontSize: "1.4rem" }}>403 — Forbidden</h1>
        <p style={{ color: "var(--muted)" }}>You need the “Manage agents” permission.</p>
      </main>
    );
  }

  return (
    <main style={shell}>
      <Link href="/admin/agents" style={{ color: "var(--accent, #2563eb)", fontSize: "0.9rem" }}>
        ← All agents
      </Link>
      <h1 style={{ fontSize: "1.5rem", margin: "0.75rem 0 1.25rem" }}>New agent</h1>
      <AgentForm
        mode="create"
        initial={{ loginId: null, agentName: "", tlName: "", joinDate: "", active: true }}
      />
    </main>
  );
}
