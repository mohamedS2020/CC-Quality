import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { deriveAgentStanding } from "@/lib/agents/status";
import { loadActiveConfig } from "@/lib/config/loader";
import { agentRepository } from "@/lib/db/repositories";
import { AgentForm } from "../agent-form";

export const dynamic = "force-dynamic";

export default async function EditAgentPage({ params }: { params: Promise<{ loginId: string }> }) {
  const { loginId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (!ctx.permissions.has("agents.manage")) {
    return (
      <main className="page page-narrow">
        <h1 className="page-title">403 — Forbidden</h1>
        <p className="page-sub">You need the “Manage agents” permission.</p>
      </main>
    );
  }

  const id = Number(loginId);
  const agent = Number.isInteger(id) ? await agentRepository.findByLoginId(id) : null;
  if (!agent) notFound();

  const config = await loadActiveConfig();
  const standing = config ? deriveAgentStanding(agent.joinDate, config) : null;

  return (
    <main className="page page-narrow">
      <Link href="/admin/agents" style={{ fontSize: "0.9rem" }}>
        ← All agents
      </Link>
      <h1 className="page-title" style={{ margin: "0.75rem 0 0.25rem" }}>
        {agent.agentName}
      </h1>
      <p className="page-sub" style={{ marginBottom: "1.25rem" }}>
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
