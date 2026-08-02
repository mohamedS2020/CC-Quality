"use client";

import { useState, useTransition } from "react";
import type { ConfigInput, LensInput, SectionInput } from "@/lib/config/input";
import { validateConfigInput } from "@/lib/config/validation";
import { SectionsEditor } from "./sections-editor";
import { RubricEditor } from "./rubric-editor";
import { LensesEditor } from "./lenses-editor";
import { DictionaryEditor } from "./dictionary-editor";
import { PolicyEditor, type PolicyFields } from "./policy-editor";
import { saveConfigAction, type SaveConfigResult } from "./actions";

const TABS = ["sections", "rubric", "lenses", "dictionary", "policy"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  sections: "Sections",
  rubric: "Rubric tree",
  lenses: "Lenses & benchmarks",
  dictionary: "Dictionary",
  policy: "Policy",
};

export function ConfigEditor({ initialDraft }: { initialDraft: ConfigInput }) {
  const [draft, setDraft] = useState<ConfigInput>(initialDraft);
  const [tab, setTab] = useState<Tab>("sections");
  const [result, setResult] = useState<SaveConfigResult | null>(null);
  const [pending, startTransition] = useTransition();

  const validation = validateConfigInput(draft);

  const setSections = (sections: SectionInput[]) => {
    setDraft((d) => ({ ...d, sections }));
    setResult(null);
  };

  const setLenses = (lenses: LensInput[]) => {
    setDraft((d) => ({ ...d, lenses }));
    setResult(null);
  };

  const setSeverities = (severities: string[]) => {
    setDraft((d) => ({ ...d, severities }));
    setResult(null);
  };

  const setTrainingBuckets = (trainingBuckets: string[]) => {
    setDraft((d) => ({ ...d, trainingBuckets }));
    setResult(null);
  };

  const setPolicy = (patch: Partial<PolicyFields>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setResult(null);
  };

  const save = () =>
    startTransition(async () => {
      setResult(await saveConfigAction(draft));
    });

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div>
        <h1 className="page-title" style={{ fontSize: "1.6rem" }}>
          Scorecard configuration
        </h1>
        <p className="page-sub">
          Editing creates a new immutable version; past periods stay pinned to their version.
        </p>
      </div>

      <label className="field" style={{ maxWidth: 320 }}>
        <span>Config name</span>
        <input
          className="input"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
      </label>

      <div role="tablist" style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={tab === t ? "btn btn-sm btn-primary" : "btn btn-sm btn-ghost"}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div>
        {tab === "sections" && <SectionsEditor sections={draft.sections} onChange={setSections} />}
        {tab === "rubric" && <RubricEditor sections={draft.sections} onChange={setSections} />}
        {tab === "lenses" && (
          <LensesEditor
            lenses={draft.lenses}
            sectionCodes={draft.sections.map((s) => s.code)}
            onChange={setLenses}
          />
        )}
        {tab === "dictionary" && (
          <DictionaryEditor
            severities={draft.severities}
            trainingBuckets={draft.trainingBuckets}
            sections={draft.sections}
            onSeveritiesChange={setSeverities}
            onTrainingBucketsChange={setTrainingBuckets}
            onSectionsChange={setSections}
          />
        )}
        {tab === "policy" && <PolicyEditor policy={draft} onChange={setPolicy} />}
      </div>

      {!validation.ok && (
        <div
          data-testid="validation-preview"
          className="card"
          style={{ borderColor: "var(--danger)", background: "var(--danger-soft)" }}
        >
          <strong>{validation.errors.length} issue(s) to resolve before saving:</strong>
          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem" }}>
            {validation.errors.slice(0, 12).map((e, i) => (
              <li key={i}>
                <code>{e.path}</code> — {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={save}
          disabled={pending || !validation.ok}
        >
          {pending ? "Saving…" : "Save as new version"}
        </button>

        {result?.ok && (
          <span style={{ color: "var(--success)" }}>Saved as version {result.version}.</span>
        )}
        {result && !result.ok && (
          <span style={{ color: "var(--danger)" }} role="alert">
            {result.message ?? `Save rejected (${result.errors?.length ?? 0} validation error(s)).`}
          </span>
        )}
      </div>
    </div>
  );
}
