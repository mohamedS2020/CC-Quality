import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { deriveAgentStanding } from "@/lib/agents/status";
import { loadActiveConfig } from "@/lib/config/loader";
import { agentRepository } from "@/lib/db/repositories";
import { AgentsList, type AgentRow } from "./agents-list";

export const dynamic = "force-dynamic";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function AgentsPage() {
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

  const [agents, config] = await Promise.all([agentRepository.list(), loadActiveConfig()]);

  const rows: AgentRow[] = agents.map((a) => {
    const standing = config ? deriveAgentStanding(a.joinDate, config) : null;
    return {
      loginId: a.loginId,
      agentName: a.agentName,
      tlName: a.tlName,
      joinDate: ymd(a.joinDate),
      status: standing?.status ?? null,
      tenureDays: standing?.tenureDays ?? null,
      inTrial: standing?.inTrial ?? false,
      active: a.active,
    };
  });

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
          <h1 className="page-title">Agents</h1>
          <p className="page-sub">
            Tenure and trial are derived from join date
            {config
              ? ` (new < ${config.newAgentTenureDays}d, trial < ${config.trialWindowDays}d).`
              : "."}
          </p>
        </div>
        <Link href="/admin/agents/new" className="btn btn-primary">
          + New agent
        </Link>
      </div>

      <AgentsList rows={rows} />
    </main>
  );
}
