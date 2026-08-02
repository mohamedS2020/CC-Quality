"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  metaIsComplete,
  metaToFields,
  ScoreSheetFields,
  type MetaState,
} from "../../_components/score-sheet-fields";
import type { EvaluationDraft, ScoreSheetAgent, ScoreSheetRubric } from "../../new/types";
import { correctEvaluationAction, type CorrectionResult } from "./actions";

export function CorrectionForm({
  evalId,
  version,
  agentName,
  rubric,
  agents,
  initialMeta,
  initialSelected,
}: {
  evalId: string;
  version: number;
  agentName: string;
  rubric: ScoreSheetRubric;
  agents: ScoreSheetAgent[];
  initialMeta: MetaState;
  initialSelected: number[];
}) {
  const router = useRouter();
  const [meta, setMeta] = useState<MetaState>(initialMeta);
  const [selected, setSelected] = useState<Set<number>>(new Set(initialSelected));
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<CorrectionResult | null>(null);
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

  const canSubmit = metaIsComplete(meta) && reason.trim() !== "";

  const submit = () => {
    const draft: EvaluationDraft = { ...metaToFields(meta), flaggedReasonIds: [...selected] };
    startTransition(async () => {
      const res = await correctEvaluationAction(evalId, draft, reason.trim());
      setResult(res);
      if (res.ok) router.push(`/evaluations/${res.evalId}`);
    });
  };

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div>
        <h1 className="page-title" style={{ fontSize: "1.6rem" }}>
          Correct evaluation
        </h1>
        <p className="page-sub">
          {agentName} · correcting v{version}. Saving writes a new version and preserves the
          original — scores are re-derived, never typed.
        </p>
      </div>

      <section className="card">
        <h2 style={{ fontSize: "1.1rem", marginTop: 0, marginBottom: "0.6rem" }}>
          Reason for correction *
        </h2>
        <textarea
          className="textarea"
          aria-label="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Why is this call being corrected?"
          style={{ resize: "vertical" }}
        />
      </section>

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
          {pending ? "Saving…" : "Save correction"}
        </button>
        {result && !result.ok && (
          <span style={{ color: "var(--danger)" }} role="alert">
            {result.message}
          </span>
        )}
      </div>
    </div>
  );
}
