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

function actionLabel(to: PeriodStatus, from: PeriodStatus): string {
  if (to === "LOCKED") return "Lock";
  if (to === "OPEN") return from === "LOCKED" ? "Reopen" : "Back to open";
  return `→ ${STATUS_LABEL[to]}`;
}

const cell: React.CSSProperties = {
  padding: "0.6rem 0.5rem",
  borderBottom: "1px solid var(--border)",
};

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
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Periods</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Move a period through open → scoring → review → locked. A locked period is immutable — new
        calls cannot land in it and existing scores cannot be edited (FR-44).
      </p>

      {initialPeriods.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>
          No periods yet. One opens automatically with the first scored call.
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)" }}>
              <th style={cell}>Period</th>
              <th style={cell}>Status</th>
              <th style={cell}>Calls</th>
              <th style={cell}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {initialPeriods.map((p) => (
              <tr key={p.id}>
                <td style={cell}>
                  {p.label} <span style={{ color: "var(--muted)" }}>({p.type.toLowerCase()})</span>
                </td>
                <td style={cell}>
                  <strong>{STATUS_LABEL[p.status]}</strong>
                  {p.status === "LOCKED" && p.lockedAt ? (
                    <span style={{ color: "var(--muted)" }}>
                      {" "}
                      · {new Date(p.lockedAt).toLocaleDateString()}
                    </span>
                  ) : null}
                </td>
                <td style={cell}>{p.evaluations}</td>
                <td style={cell}>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {NEXT[p.status].map((to) => (
                      <button
                        key={to}
                        type="button"
                        disabled={pending}
                        onClick={() => run(p.id, to)}
                        style={{
                          padding: "0.3rem 0.6rem",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          background: to === "LOCKED" ? "var(--danger, #b91c1c)" : "transparent",
                          color: to === "LOCKED" ? "#fff" : "inherit",
                          cursor: pending ? "default" : "pointer",
                        }}
                      >
                        {actionLabel(to, p.status)}
                      </button>
                    ))}
                  </div>
                  {error && error.id === p.id ? (
                    <p style={{ color: "var(--danger, #b91c1c)", marginTop: "0.4rem" }}>
                      {error.text}
                    </p>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
