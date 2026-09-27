"use client";

import { useState, useTransition } from "react";
import {
  EMPTY_META,
  metaIsComplete,
  metaToFields,
  ScoreSheetFields,
  type MetaState,
} from "../_components/score-sheet-fields";
import type { EvaluationDraft, ScoreSheetAgent, ScoreSheetRubric } from "./types";
import { createEvaluationAction, type CreateEvaluationResult } from "./actions";

export function ScoreSheetForm({
  rubric,
  agents,
  defaultQaOwner,
  canCoach = false,
}: {
  rubric: ScoreSheetRubric;
  agents: ScoreSheetAgent[];
  defaultQaOwner: string;
  canCoach?: boolean;
}) {
  const [meta, setMeta] = useState<MetaState>({ ...EMPTY_META, qaOwner: defaultQaOwner });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<CreateEvaluationResult | null>(null);
  const [pending, startTransition] = useTransition();

  const [coachEmail, setCoachEmail] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachText, setCoachText] = useState("");

  const setField = (key: keyof MetaState, value: string) =>
    setMeta((m) => ({ ...m, [key]: value }));

  const toggleReason = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canSubmit = metaIsComplete(meta);

  const doSubmit = (coaching?: string) => {
    const draft: EvaluationDraft = { ...metaToFields(meta), flaggedReasonIds: [...selected] };
    startTransition(async () => {
      setResult(await createEvaluationAction(draft, coaching));
      setCoachOpen(false);
    });
  };

  // With the coaching option ticked, ask for the coaching text before saving.
  const onSave = () => {
    if (coachEmail) setCoachOpen(true);
    else doSubmit();
  };

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div>
        <h1 className="page-title" style={{ fontSize: "1.6rem" }}>
          New score sheet
        </h1>
        <p className="page-sub">
          Enter the call details and flag every error. Scores are derived on save — never typed.
        </p>
      </div>

      <ScoreSheetFields
        rubric={rubric}
        agents={agents}
        meta={meta}
        setField={setField}
        selected={selected}
        toggleReason={toggleReason}
      />

      {canCoach && (
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.9rem" }}>
          <input
            type="checkbox"
            checked={coachEmail}
            onChange={(e) => setCoachEmail(e.target.checked)}
          />
          Send a coaching email on save (only if the call fails)
        </label>
      )}

      {coachOpen && (
        <div className="card" style={{ maxWidth: 560, display: "grid", gap: "0.6rem" }}>
          <strong>Coaching message to the agent</strong>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            Added to the coaching email with the call data and failed sections. Sent only if the
            call fails.
          </p>
          <textarea
            className="input"
            aria-label="coaching-text"
            rows={4}
            value={coachText}
            onChange={(e) => setCoachText(e.target.value)}
            placeholder="Write the coaching guidance for the agent…"
          />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={pending || coachText.trim() === ""}
              onClick={() => doSubmit(coachText)}
            >
              Save &amp; send coaching
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={pending}
              onClick={() => setCoachOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSave}
          disabled={!canSubmit || pending || coachOpen}
        >
          {pending ? "Saving…" : "Save score sheet"}
        </button>
        {result?.ok && (
          <span style={{ color: "var(--success)" }}>
            Saved evaluation {result.evalId}.{result.coaching === "sent" && " Coaching email sent."}
            {result.coaching === "passed" && " Call passed — no coaching email sent."}
            {result.coaching === "error" && " (Coaching email could not be sent.)"}
          </span>
        )}
        {result && !result.ok && (
          <span style={{ color: "var(--danger)" }} role="alert">
            {result.message}
          </span>
        )}
      </div>
    </div>
  );
}
