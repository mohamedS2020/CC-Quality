import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { loadConfigById } from "@/lib/config/loader";
import { prisma } from "@/lib/db/client";
import { agentRepository } from "@/lib/db/repositories";
import { rubricFromConfig } from "@/lib/evaluations/rubric";
import { EMPTY_META, type MetaState } from "../../_components/score-sheet-fields";
import { CorrectionForm } from "./correction-form";

export const dynamic = "force-dynamic";

function hhmm(t: Date | null): string {
  return t ? t.toISOString().slice(11, 16) : "";
}
function ymd(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function CorrectEvaluationPage({
  params,
}: {
  params: Promise<{ evalId: string }>;
}) {
  const { evalId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (!ctx.permissions.has("evaluations.edit")) {
    return (
      <main className="page page-narrow">
        <h1 className="page-title">403 — Forbidden</h1>
        <p className="page-sub">You need the “Edit evaluations” permission.</p>
      </main>
    );
  }

  const evaluation = await prisma.evaluation.findUnique({
    where: { evalId },
    include: { agent: { select: { agentName: true } }, lines: { select: { errorReasonId: true } } },
  });
  if (!evaluation) notFound();

  // Only the current version is correctable; send stale links back to the detail.
  if (evaluation.supersededAt) redirect(`/evaluations/${evalId}`);

  const config = await loadConfigById(evaluation.configId);
  if (!config) {
    return (
      <main className="page page-narrow">
        <h1 className="page-title">Configuration unavailable</h1>
        <p className="page-sub">
          The configuration version this call was scored under could not be loaded.
        </p>
      </main>
    );
  }

  const initialMeta: MetaState = {
    ...EMPTY_META,
    agentLoginId: String(evaluation.agentLoginId),
    qaOwner: evaluation.qaOwner,
    callDate: ymd(evaluation.callDate),
    callStart: hhmm(evaluation.callStart),
    callEnd: hhmm(evaluation.callEnd),
    durationSeconds: evaluation.durationSeconds != null ? String(evaluation.durationSeconds) : "",
    callId: evaluation.callId ?? "",
    queue: evaluation.queue ?? "",
    transactionType: evaluation.transactionType ?? "",
    monitoringType: evaluation.monitoringType ?? "",
    callType: evaluation.callType ?? "",
    mobile: evaluation.mobileMasked ?? "",
    coachingDate: ymd(evaluation.coachingDate),
  };

  const agents = (await agentRepository.list({ activeOnly: true })).map((a) => ({
    loginId: a.loginId,
    agentName: a.agentName,
  }));

  return (
    <main className="page">
      <CorrectionForm
        evalId={evaluation.evalId}
        version={evaluation.version}
        agentName={evaluation.agent.agentName}
        rubric={rubricFromConfig(config)}
        agents={agents}
        initialMeta={initialMeta}
        initialSelected={evaluation.lines.map((l) => l.errorReasonId)}
      />
    </main>
  );
}
