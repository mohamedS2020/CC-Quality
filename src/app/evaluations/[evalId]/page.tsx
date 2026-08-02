import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { agentScopeFor } from "@/lib/auth/scope";
import { getEvaluationHistory, type EvaluationVersion } from "@/lib/evaluations/query";
import { displayMobile } from "@/lib/pii";

export const dynamic = "force-dynamic";

const shell: React.CSSProperties = { maxWidth: 900, margin: "0 auto", padding: "2.5rem 1.5rem" };
const card: React.CSSProperties = {
  border: "1px solid var(--border, #ccc)",
  borderRadius: 8,
  padding: "1rem 1.25rem",
};

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}
function fmtDateTime(d: Date | null): string {
  return d ? d.toISOString().slice(0, 16).replace("T", " ") : "—";
}

function resultStyle(failed: boolean): React.CSSProperties {
  return { color: failed ? "var(--danger, #b91c1c)" : "var(--success, #2e7d32)", fontWeight: 600 };
}

function VersionCard({ v, isCurrent }: { v: EvaluationVersion; isCurrent: boolean }) {
  return (
    <li
      style={{ ...card, borderColor: isCurrent ? "var(--accent, #2563eb)" : "var(--border, #ccc)" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <strong>
          v{v.version}
          {isCurrent && <span style={{ color: "var(--accent, #2563eb)" }}> · current</span>}
        </strong>
        <span style={resultStyle(v.failedScorecard)}>
          {v.overallStatus ?? (v.failedScorecard ? "Fail" : "Pass")}
        </span>
      </div>
      <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
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
      <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
        {v.lines.length === 0 ? (
          <span style={{ color: "var(--muted)" }}>No errors flagged.</span>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {v.lines.map((line) => {
              const attr = line.errorReason.attribute;
              return (
                <li key={line.id}>
                  <span style={{ color: "var(--muted)" }}>{attr.category.section.code}</span> —{" "}
                  {attr.label}: {line.errorReason.label}
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
      <main style={shell}>
        <h1 style={{ fontSize: "1.4rem" }}>403 — Forbidden</h1>
        <p style={{ color: "var(--muted)" }}>You need the “View evaluations” permission.</p>
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
    <main style={shell}>
      <Link href="/evaluations" style={{ color: "var(--accent, #2563eb)", fontSize: "0.9rem" }}>
        ← All evaluations
      </Link>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginTop: "0.75rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>{current.agent.agentName}</h1>
        <span style={resultStyle(current.failedScorecard)}>
          {current.overallStatus ?? (current.failedScorecard ? "Fail" : "Pass")}
        </span>
      </div>
      <p style={{ color: "var(--muted)", marginTop: "0.25rem" }}>
        Call {fmtDate(current.callDate)} · Mobile {displayMobile(current.mobileMasked)} · Sum of
        criticals {current.sumOfCriticals}
      </p>

      {ctx.permissions.has("evaluations.edit") && (
        <Link
          href={`/evaluations/${current.evalId}/correct`}
          style={{
            display: "inline-block",
            marginTop: "0.5rem",
            padding: "0.45rem 0.9rem",
            borderRadius: 6,
            border: "1px solid var(--border, #ccc)",
            color: "inherit",
          }}
        >
          Post a correction
        </Link>
      )}

      <h2 style={{ fontSize: "1.15rem", marginTop: "1.75rem" }}>
        Version history{" "}
        <span style={{ color: "var(--muted)", fontWeight: 400 }}>(audit trail)</span>
      </h2>
      <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
        {[...history].reverse().map((v) => (
          <VersionCard key={v.evalId} v={v} isCurrent={v.evalId === current.evalId} />
        ))}
      </ol>
    </main>
  );
}
