import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { agentRepository } from "@/lib/db/repositories";
import { loadActiveConfig } from "@/lib/config/loader";
import { rubricFromConfig } from "@/lib/evaluations/rubric";
import { ScoreSheetForm } from "./score-sheet-form";

export const dynamic = "force-dynamic";

export default async function NewEvaluationPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (!ctx.permissions.has("evaluations.create")) {
    return (
      <main className="page page-narrow">
        <h1 className="page-title">403 — Forbidden</h1>
        <p className="page-sub">You need the “Create evaluations” permission to score calls.</p>
      </main>
    );
  }

  const config = await loadActiveConfig();
  if (!config) {
    return (
      <main className="page page-narrow">
        <h1 className="page-title">No active configuration</h1>
        <p className="page-sub">
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
    <main className="page">
      <ScoreSheetForm rubric={rubric} agents={agents} defaultQaOwner={ctx.user.name} />
    </main>
  );
}
