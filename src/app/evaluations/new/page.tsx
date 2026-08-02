import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { agentRepository } from "@/lib/db/repositories";
import { loadActiveConfig } from "@/lib/config/loader";
import { rubricFromConfig } from "@/lib/evaluations/rubric";
import { ScoreSheetForm } from "./score-sheet-form";

export const dynamic = "force-dynamic";

const shell: React.CSSProperties = { maxWidth: 900, margin: "0 auto", padding: "2.5rem 1.5rem" };

export default async function NewEvaluationPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (!ctx.permissions.has("evaluations.create")) {
    return (
      <main style={shell}>
        <h1 style={{ fontSize: "1.4rem" }}>403 — Forbidden</h1>
        <p style={{ color: "var(--muted)" }}>
          You need the “Create evaluations” permission to score calls.
        </p>
      </main>
    );
  }

  const config = await loadActiveConfig();
  if (!config) {
    return (
      <main style={shell}>
        <h1 style={{ fontSize: "1.4rem" }}>No active configuration</h1>
        <p style={{ color: "var(--muted)" }}>
          An admin must publish a scorecard configuration before calls can be scored.
        </p>
      </main>
    );
  }

  const rubric = rubricFromConfig(config);

  const agents = (await agentRepository.list({ activeOnly: true })).map((a) => ({
    loginId: a.loginId,
    agentName: a.agentName,
  }));

  return (
    <main style={shell}>
      <ScoreSheetForm rubric={rubric} agents={agents} defaultQaOwner={ctx.user.name} />
    </main>
  );
}
