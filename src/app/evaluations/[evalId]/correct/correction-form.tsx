"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  box,
  input,
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
        <h1 style={{ fontSize: "1.6rem", marginBottom: "0.25rem" }}>Correct evaluation</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          {agentName} · correcting v{version}. Saving writes a new version and preserves the
          original — scores are re-derived, never typed.
        </p>
      </div>

      <section style={box}>
        <h2 style={{ fontSize: "1.15rem", marginTop: 0 }}>Reason for correction *</h2>
        <textarea
          aria-label="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Why is this call being corrected?"
          style={{ ...input, width: "100%", resize: "vertical" }}
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
          onClick={submit}
          disabled={!canSubmit || pending}
          style={{
            padding: "0.55rem 1rem",
            borderRadius: 6,
            border: "none",
            background: "var(--accent, #2563eb)",
            color: "#fff",
            cursor: !canSubmit || pending ? "not-allowed" : "pointer",
            opacity: !canSubmit || pending ? 0.6 : 1,
          }}
        >
          {pending ? "Saving…" : "Save correction"}
        </button>
        {result && !result.ok && (
          <span style={{ color: "var(--danger, #c0392b)" }} role="alert">
            {result.message}
          </span>
        )}
      </div>
    </div>
  );
}
