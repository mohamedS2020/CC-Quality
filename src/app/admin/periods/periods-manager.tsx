"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PeriodStatus, PeriodType } from "@prisma/client";
import { transitionPeriodAction } from "./actions";

export type PeriodRow = {
  id: number;
  type: PeriodType;
  label: string;
  status: PeriodStatus;
  evaluations: number;
  lockedAt: string | null;
};

// Mirrors the server state machine (which re-validates); a stale client just
// yields a rejected action, never a bad write.
const NEXT: Record<PeriodStatus, PeriodStatus[]> = {
  OPEN: ["SCORING", "REVIEW", "LOCKED"],
  SCORING: ["REVIEW", "OPEN", "LOCKED"],
  REVIEW: ["SCORING", "OPEN", "LOCKED"],
  LOCKED: ["OPEN"],
};

const STATUS_LABEL: Record<PeriodStatus, string> = {
  OPEN: "Open",
  SCORING: "Scoring",
  REVIEW: "Review",
  LOCKED: "Locked",
};

const STATUS_BADGE: Record<PeriodStatus, string> = {
  OPEN: "badge badge-success",
  SCORING: "badge badge-accent",
  REVIEW: "badge badge-warning",
  LOCKED: "badge badge-danger",
};

function actionLabel(to: PeriodStatus, from: PeriodStatus): string {
  if (to === "LOCKED") return "Lock";
  if (to === "OPEN") return from === "LOCKED" ? "Reopen" : "Back to open";
  return `→ ${STATUS_LABEL[to]}`;
}

export function PeriodsManager({ initialPeriods }: { initialPeriods: PeriodRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<{ id: number; text: string } | null>(null);

  function run(id: number, to: PeriodStatus) {
    setError(null);
    startTransition(async () => {
      const res = await transitionPeriodAction(id, to);
      if (res.ok) router.refresh();
      else setError({ id, text: res.message });
    });
  }

  return (
    <section>
      <h1 className="page-title">Periods</h1>
      <p className="page-sub" style={{ marginBottom: "1.5rem" }}>
        Move a period through open → scoring → review → locked. A locked period is immutable — new
        calls cannot land in it and existing scores cannot be edited (FR-44).
      </p>

      {initialPeriods.length === 0 ? (
        <p className="empty">No periods yet. One opens automatically with the first scored call.</p>
      ) : (
        <div className="card" style={{ padding: "0.5rem 0.75rem" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Status</th>
                <th>Calls</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialPeriods.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.label} <span className="muted">({p.type.toLowerCase()})</span>
                  </td>
                  <td>
                    <span className={STATUS_BADGE[p.status]}>{STATUS_LABEL[p.status]}</span>
                    {p.status === "LOCKED" && p.lockedAt ? (
                      <span className="muted"> · {new Date(p.lockedAt).toLocaleDateString()}</span>
                    ) : null}
                  </td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.evaluations}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {NEXT[p.status].map((to) => (
                        <button
                          key={to}
                          type="button"
                          className={
                            to === "LOCKED" ? "btn btn-sm btn-danger" : "btn btn-sm btn-ghost"
                          }
                          disabled={pending}
                          onClick={() => run(p.id, to)}
                        >
                          {actionLabel(to, p.status)}
                        </button>
                      ))}
                    </div>
                    {error && error.id === p.id ? (
                      <p style={{ color: "var(--danger)", marginTop: "0.4rem" }}>{error.text}</p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
