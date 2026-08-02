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

const input: React.CSSProperties = {
  padding: "0.45rem 0.6rem",
  borderRadius: 6,
  border: "1px solid var(--border, #ccc)",
  background: "var(--background, #fff)",
  color: "inherit",
  minWidth: 260,
};

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
        <h1 style={{ fontSize: "1.6rem", marginBottom: "0.25rem" }}>Scorecard configuration</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Editing creates a new immutable version; past periods stay pinned to their version.
        </p>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        <span>Config name</span>
        <input
          style={input}
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
      </label>

      <div role="tablist" style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: 6,
              border: "1px solid var(--border, #ccc)",
              background: tab === t ? "var(--accent, #2563eb)" : "transparent",
              color: tab === t ? "#fff" : "inherit",
              cursor: "pointer",
            }}
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
          style={{
            border: "1px solid var(--danger, #c0392b)",
            borderRadius: 8,
            padding: "0.75rem",
          }}
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
          onClick={save}
          disabled={pending || !validation.ok}
          style={{
            padding: "0.55rem 1rem",
            borderRadius: 6,
            border: "none",
            background: "var(--accent, #2563eb)",
            color: "#fff",
            cursor: pending || !validation.ok ? "not-allowed" : "pointer",
            opacity: pending || !validation.ok ? 0.6 : 1,
          }}
        >
          {pending ? "Saving…" : "Save as new version"}
        </button>

        {result?.ok && (
          <span style={{ color: "var(--success, #2e7d32)" }}>
            Saved as version {result.version}.
          </span>
        )}
        {result && !result.ok && (
          <span style={{ color: "var(--danger, #c0392b)" }} role="alert">
            {result.message ?? `Save rejected (${result.errors?.length ?? 0} validation error(s)).`}
          </span>
        )}
      </div>
    </div>
  );
}
