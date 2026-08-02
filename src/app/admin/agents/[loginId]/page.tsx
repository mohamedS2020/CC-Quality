import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { deriveAgentStanding } from "@/lib/agents/status";
import { loadActiveConfig } from "@/lib/config/loader";
import { agentRepository } from "@/lib/db/repositories";
import { AgentForm } from "../agent-form";

export const dynamic = "force-dynamic";

const shell: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "2.5rem 1.5rem" };

export default async function EditAgentPage({ params }: { params: Promise<{ loginId: string }> }) {
  const { loginId } = await params;
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

  const id = Number(loginId);
  const agent = Number.isInteger(id) ? await agentRepository.findByLoginId(id) : null;
  if (!agent) notFound();

  const config = await loadActiveConfig();
  const standing = config ? deriveAgentStanding(agent.joinDate, config) : null;

  return (
    <main style={shell}>
      <Link href="/admin/agents" style={{ color: "var(--accent, #2563eb)", fontSize: "0.9rem" }}>
        ← All agents
      </Link>
      <h1 style={{ fontSize: "1.5rem", margin: "0.75rem 0 0.25rem" }}>{agent.agentName}</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.25rem" }}>
        Login {agent.loginId}
        {standing
          ? ` · ${standing.status} · ${standing.tenureDays}d tenure${standing.inTrial ? " · in trial" : ""}`
          : ""}
      </p>

      <AgentForm
        mode="edit"
        initial={{
          loginId: agent.loginId,
          agentName: agent.agentName,
          tlName: agent.tlName,
          joinDate: agent.joinDate.toISOString().slice(0, 10),
          active: agent.active,
        }}
      />
    </main>
  );
}
