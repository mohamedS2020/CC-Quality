"use client";

import { useMemo } from "react";
import type { ScoreSheetAgent, ScoreSheetRubric } from "../new/types";

/** The controlled metadata state shared by the new-score and correction forms. */
export interface MetaState {
  agentLoginId: string;
  qaOwner: string;
  callDate: string;
  callStart: string;
  callEnd: string;
  durationSeconds: string;
  callId: string;
  queue: string;
  transactionType: string;
  monitoringType: string;
  callType: string;
  mobile: string;
  coachingDate: string;
}

export const EMPTY_META: MetaState = {
  agentLoginId: "",
  qaOwner: "",
  callDate: "",
  callStart: "",
  callEnd: "",
  durationSeconds: "",
  callId: "",
  queue: "",
  transactionType: "",
  monitoringType: "",
  callType: "",
  mobile: "",
  coachingDate: "",
};

const TEXT_FIELDS: { key: keyof MetaState; label: string; type: string }[] = [
  { key: "callDate", label: "Call date", type: "date" },
  { key: "callStart", label: "Call start", type: "time" },
  { key: "callEnd", label: "Call end", type: "time" },
  { key: "durationSeconds", label: "Duration (sec)", type: "number" },
  { key: "callId", label: "Call ID", type: "text" },
  { key: "queue", label: "Queue", type: "text" },
  { key: "monitoringType", label: "Monitoring type", type: "text" },
  { key: "callType", label: "Call type", type: "text" },
  { key: "mobile", label: "Mobile (PII)", type: "text" },
  { key: "coachingDate", label: "Coaching date", type: "date" },
];

/** Turn the controlled metadata into the enter-only fields the services accept. */
export function metaToFields(meta: MetaState) {
  return {
    agentLoginId: Number(meta.agentLoginId),
    qaOwner: meta.qaOwner.trim(),
    callDate: meta.callDate,
    callStart: meta.callStart || undefined,
    callEnd: meta.callEnd || undefined,
    durationSeconds: meta.durationSeconds ? Number(meta.durationSeconds) : undefined,
    mobile: meta.mobile || undefined,
    callId: meta.callId || undefined,
    queue: meta.queue || undefined,
    transactionType: meta.transactionType || undefined,
    monitoringType: meta.monitoringType || undefined,
    callType: meta.callType || undefined,
    coachingDate: meta.coachingDate || undefined,
  };
}

export function metaIsComplete(meta: MetaState): boolean {
  return meta.agentLoginId !== "" && meta.callDate !== "" && meta.qaOwner.trim() !== "";
}

const fieldsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: "0.9rem",
};

export function ScoreSheetFields({
  rubric,
  agents,
  meta,
  setField,
  selected,
  toggleReason,
}: {
  rubric: ScoreSheetRubric;
  agents: ScoreSheetAgent[];
  meta: MetaState;
  setField: (key: keyof MetaState, value: string) => void;
  selected: Set<number>;
  toggleReason: (id: number) => void;
}) {
  const countBySection = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of rubric.sections) {
      let n = 0;
      for (const c of s.categories)
        for (const a of c.attributes)
          for (const r of a.errorReasons) if (selected.has(r.id)) n += 1;
      map.set(s.id, n);
    }
    return map;
  }, [rubric, selected]);

  return (
    <>
      <section className="card">
        <h2 style={{ fontSize: "1.1rem", marginTop: 0, marginBottom: "0.9rem" }}>Call details</h2>
        <div style={fieldsGrid}>
          <label className="field">
            <span>Agent *</span>
            <select
              className="select"
              aria-label="agent"
              value={meta.agentLoginId}
              onChange={(e) => setField("agentLoginId", e.target.value)}
            >
              <option value="">— select agent —</option>
              {agents.map((a) => (
                <option key={a.loginId} value={a.loginId}>
                  {a.agentName} ({a.loginId})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>QA owner *</span>
            <input
              className="input"
              aria-label="qaOwner"
              value={meta.qaOwner}
              onChange={(e) => setField("qaOwner", e.target.value)}
            />
          </label>
          <label className="field">
            <span>Transaction type</span>
            <select
              className="select"
              aria-label="transactionType"
              value={meta.transactionType}
              onChange={(e) => setField("transactionType", e.target.value)}
            >
              <option value="">—</option>
              <option value="IB">IB</option>
              <option value="OB">OB</option>
            </select>
          </label>
          {TEXT_FIELDS.map((f) => (
            <label key={f.key} className="field">
              <span>{f.label}</span>
              <input
                className="input"
                type={f.type}
                aria-label={f.key}
                value={meta[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gap: "0.85rem" }}>
        <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Errors</h2>
        {rubric.sections.map((s) => (
          <fieldset
            key={s.id}
            className="card"
            data-testid="score-section"
            style={{ border: "1px solid var(--border)" }}
          >
            <legend style={{ fontWeight: 600, padding: "0 0.4rem" }}>
              {s.code} — {s.label} ·{" "}
              <span data-testid={`section-${s.id}-count`}>{countBySection.get(s.id) ?? 0}</span>{" "}
              flagged
            </legend>
            {s.categories.map((c) => (
              <div key={c.id} style={{ margin: "0.5rem 0 0.5rem 0.25rem" }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{c.label}</div>
                {c.attributes.map((a) => (
                  <div key={a.id} style={{ margin: "0.35rem 0 0.35rem 0.75rem" }}>
                    <div
                      style={{ fontStyle: "italic", color: "var(--muted)", fontSize: "0.85rem" }}
                    >
                      {a.label}
                    </div>
                    {a.errorReasons.map((r) => (
                      <label
                        key={r.id}
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          alignItems: "center",
                          marginLeft: "0.75rem",
                          padding: "0.15rem 0",
                        }}
                      >
                        <input
                          type="checkbox"
                          aria-label={`reason-${r.id}`}
                          checked={selected.has(r.id)}
                          onChange={() => toggleReason(r.id)}
                        />
                        <span>{r.label}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </fieldset>
        ))}
      </section>
    </>
  );
}
