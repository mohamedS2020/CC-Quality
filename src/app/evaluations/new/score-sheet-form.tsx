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
}: {
  rubric: ScoreSheetRubric;
  agents: ScoreSheetAgent[];
  defaultQaOwner: string;
}) {
  const [meta, setMeta] = useState<MetaState>({ ...EMPTY_META, qaOwner: defaultQaOwner });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<CreateEvaluationResult | null>(null);
  const [pending, startTransition] = useTransition();

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

  const submit = () => {
    const draft: EvaluationDraft = { ...metaToFields(meta), flaggedReasonIds: [...selected] };
    startTransition(async () => setResult(await createEvaluationAction(draft)));
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

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={submit}
          disabled={!canSubmit || pending}
        >
          {pending ? "Saving…" : "Save score sheet"}
        </button>
        {result?.ok && (
          <span style={{ color: "var(--success)" }}>Saved evaluation {result.evalId}.</span>
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
