import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { agentScopeFor } from "@/lib/auth/scope";
import { getEvaluationHistory, type EvaluationVersion } from "@/lib/evaluations/query";
import { displayMobile } from "@/lib/pii";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}
function fmtDateTime(d: Date | null): string {
  return d ? d.toISOString().slice(0, 16).replace("T", " ") : "—";
}

function StatusBadge({ failed, label }: { failed: boolean; label: string }) {
  return <span className={failed ? "badge badge-danger" : "badge badge-success"}>{label}</span>;
}

function VersionCard({ v, isCurrent }: { v: EvaluationVersion; isCurrent: boolean }) {
  return (
    <li className="card" style={{ borderColor: isCurrent ? "var(--accent)" : "var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>
          v{v.version}
          {isCurrent && (
            <span className="badge badge-accent" style={{ marginLeft: "0.5rem" }}>
              current
            </span>
          )}
        </strong>
        <StatusBadge
          failed={v.failedScorecard}
          label={v.overallStatus ?? (v.failedScorecard ? "Fail" : "Pass")}
        />
      </div>
      <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.4rem" }}>
        {v.version === 1 ? (
          <>
            Scored by {v.qaOwner} · {fmtDateTime(v.creationDate)}
          </>
        ) : (
          <>
            Corrected by {v.correctedBy?.name ?? "—"} · {fmtDateTime(v.creationDate)}
            {v.correctionReason ? <> · “{v.correctionReason}”</> : null}
          </>
        )}
      </div>
      <div style={{ marginTop: "0.6rem", fontSize: "0.9rem" }}>
        {v.lines.length === 0 ? (
          <span className="muted">No errors flagged.</span>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {v.lines.map((line) => {
              const attr = line.errorReason.attribute;
              return (
                <li key={line.id}>
                  <span className="muted">{attr.category.section.code}</span> — {attr.label}:{" "}
                  {line.errorReason.label}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </li>
  );
}

export default async function EvaluationDetailPage({
  params,
}: {
  params: Promise<{ evalId: string }>;
}) {
  const { evalId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (!ctx.permissions.has("evaluations.view")) {
    return (
      <main className="page page-narrow">
        <h1 className="page-title">403 — Forbidden</h1>
        <p className="page-sub">You need the “View evaluations” permission.</p>
      </main>
    );
  }

  const history = await getEvaluationHistory(evalId);
  if (!history || history.length === 0) notFound();

  const current = history[history.length - 1];

  // Self-scope (FR-9): an Agent may only open their own call.
  const scope = agentScopeFor(ctx);
  if (scope.kind === "self" && current.agentLoginId !== scope.loginId) notFound();

  return (
    <main className="page page-narrow">
      <Link href="/evaluations" style={{ fontSize: "0.9rem" }}>
        ← All evaluations
      </Link>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "0.85rem",
          gap: "1rem",
        }}
      >
        <h1 className="page-title">{current.agent.agentName}</h1>
        <StatusBadge
          failed={current.failedScorecard}
          label={current.overallStatus ?? (current.failedScorecard ? "Fail" : "Pass")}
        />
      </div>
      <p className="page-sub">
        Call {fmtDate(current.callDate)} · Config v{current.config.version} · Mobile{" "}
        {displayMobile(current.mobileMasked)} · Sum of criticals {current.sumOfCriticals}
      </p>

      {ctx.permissions.has("evaluations.edit") && (
        <Link
          href={`/evaluations/${current.evalId}/correct`}
          className="btn btn-ghost"
          style={{ marginTop: "0.85rem" }}
        >
          Post a correction
        </Link>
      )}

      <h2 style={{ fontSize: "1.15rem", marginTop: "1.85rem" }}>
        Revision history{" "}
        <span className="muted" style={{ fontWeight: 400 }}>
          (corrections audit trail)
        </span>
      </h2>
      <ol
        style={{
          listStyle: "none",
          padding: 0,
          display: "grid",
          gap: "0.75rem",
          marginTop: "0.75rem",
        }}
      >
        {[...history].reverse().map((v) => (
          <VersionCard key={v.evalId} v={v} isCurrent={v.evalId === current.evalId} />
        ))}
      </ol>
    </main>
  );
}
