"use client";

import type { DictionaryInput, SectionInput } from "@/lib/config/input";

const emptyDict = (): DictionaryInput => ({
  definition: null,
  severityLabel: null,
  trainingBucketLabel: null,
  thresholds: [],
});

function isEmptyDict(d: DictionaryInput): boolean {
  return (
    (!d.definition || d.definition.trim() === "") &&
    d.severityLabel == null &&
    d.trainingBucketLabel == null &&
    d.thresholds.length === 0
  );
}

const row: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  alignItems: "center",
  flexWrap: "wrap",
};
const input: React.CSSProperties = {
  padding: "0.35rem 0.5rem",
  borderRadius: 6,
  border: "1px solid var(--border, #ccc)",
  background: "var(--background, #fff)",
  color: "inherit",
};
const box: React.CSSProperties = {
  border: "1px solid var(--border, #ccc)",
  borderRadius: 8,
  padding: "0.75rem 1rem",
};

function StringList({
  title,
  items,
  onChange,
  idPrefix,
}: {
  title: string;
  items: string[];
  onChange: (next: string[]) => void;
  idPrefix: string;
}) {
  return (
    <div style={box}>
      <strong>{title}</strong>
      <div style={{ display: "grid", gap: "0.4rem", margin: "0.5rem 0" }}>
        {items.map((value, i) => (
          <div key={i} style={row}>
            <input
              style={{ ...input, minWidth: 220 }}
              aria-label={`${idPrefix}-${i}`}
              value={value}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <button
              type="button"
              aria-label={`${idPrefix}-${i}-remove`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button type="button" aria-label={`add-${idPrefix}`} onClick={() => onChange([...items, ""])}>
        + Add
      </button>
    </div>
  );
}

interface FlatReason {
  si: number;
  ci: number;
  ai: number;
  ri: number;
  path: string;
  dictionary: DictionaryInput | null;
}

function flattenReasons(sections: SectionInput[]): FlatReason[] {
  const out: FlatReason[] = [];
  sections.forEach((s, si) =>
    s.categories.forEach((c, ci) =>
      c.attributes.forEach((a, ai) =>
        a.errorReasons.forEach((r, ri) => {
          out.push({
            si,
            ci,
            ai,
            ri,
            path: `${s.code || "?"} › ${c.label || "?"} › ${a.label || "?"} › ${r.label || "(unnamed)"}`,
            dictionary: r.dictionary,
          });
        }),
      ),
    ),
  );
  return out;
}

export function DictionaryEditor({
  severities,
  trainingBuckets,
  sections,
  onSeveritiesChange,
  onTrainingBucketsChange,
  onSectionsChange,
}: {
  severities: string[];
  trainingBuckets: string[];
  sections: SectionInput[];
  onSeveritiesChange: (next: string[]) => void;
  onTrainingBucketsChange: (next: string[]) => void;
  onSectionsChange: (next: SectionInput[]) => void;
}) {
  const patchReasonDictionary = (
    si: number,
    ci: number,
    ai: number,
    ri: number,
    updater: (d: DictionaryInput) => DictionaryInput,
  ) =>
    onSectionsChange(
      sections.map((s, i) =>
        i !== si
          ? s
          : {
              ...s,
              categories: s.categories.map((c, j) =>
                j !== ci
                  ? c
                  : {
                      ...c,
                      attributes: c.attributes.map((a, k) =>
                        k !== ai
                          ? a
                          : {
                              ...a,
                              errorReasons: a.errorReasons.map((r, m) => {
                                if (m !== ri) return r;
                                const next = updater(r.dictionary ?? emptyDict());
                                return { ...r, dictionary: isEmptyDict(next) ? null : next };
                              }),
                            },
                      ),
                    },
              ),
            },
      ),
    );

  const reasons = flattenReasons(sections);

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <StringList
          title="Severities"
          items={severities}
          onChange={onSeveritiesChange}
          idPrefix="severity"
        />
        <StringList
          title="Training buckets"
          items={trainingBuckets}
          onChange={onTrainingBucketsChange}
          idPrefix="bucket"
        />
      </div>

      <div>
        <h2 style={{ fontSize: "1.2rem" }}>Error reason dictionary</h2>
        {reasons.length === 0 && (
          <p style={{ color: "var(--muted)" }}>
            Add error reasons in the Rubric tree tab, then annotate them here.
          </p>
        )}

        <div style={{ display: "grid", gap: "0.75rem" }}>
          {reasons.map(({ si, ci, ai, ri, path, dictionary }) => {
            const base = `reason-${si}-${ci}-${ai}-${ri}`;
            const d = dictionary;
            return (
              <div key={base} style={box} data-testid="dict-reason">
                <div style={{ fontWeight: 600, marginBottom: "0.4rem" }}>{path}</div>
                <div style={row}>
                  <input
                    style={{ ...input, flex: 1, minWidth: 220 }}
                    placeholder="Definition & examples"
                    aria-label={`${base}-definition`}
                    value={d?.definition ?? ""}
                    onChange={(e) =>
                      patchReasonDictionary(si, ci, ai, ri, (cur) => ({
                        ...cur,
                        definition: e.target.value || null,
                      }))
                    }
                  />
                  <select
                    style={input}
                    aria-label={`${base}-severity`}
                    value={d?.severityLabel ?? ""}
                    onChange={(e) =>
                      patchReasonDictionary(si, ci, ai, ri, (cur) => ({
                        ...cur,
                        severityLabel: e.target.value || null,
                      }))
                    }
                  >
                    <option value="">— severity —</option>
                    {severities.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <select
                    style={input}
                    aria-label={`${base}-bucket`}
                    value={d?.trainingBucketLabel ?? ""}
                    onChange={(e) =>
                      patchReasonDictionary(si, ci, ai, ri, (cur) => ({
                        ...cur,
                        trainingBucketLabel: e.target.value || null,
                      }))
                    }
                  >
                    <option value="">— training bucket —</option>
                    {trainingBuckets.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.35rem" }}>
                  {(d?.thresholds ?? []).map((t, ti) => (
                    <div key={ti} style={row} data-testid="dict-threshold">
                      <input
                        style={{ ...input, flex: 1, minWidth: 180 }}
                        placeholder="when (e.g. 4 <= seconds <= 10)"
                        aria-label={`${base}-th-${ti}-when`}
                        value={t.whenExpr}
                        onChange={(e) =>
                          patchReasonDictionary(si, ci, ai, ri, (cur) => ({
                            ...cur,
                            thresholds: cur.thresholds.map((x, j) =>
                              j === ti ? { ...x, whenExpr: e.target.value } : x,
                            ),
                          }))
                        }
                      />
                      <select
                        style={input}
                        aria-label={`${base}-th-${ti}-severity`}
                        value={t.severityLabel ?? ""}
                        onChange={(e) =>
                          patchReasonDictionary(si, ci, ai, ri, (cur) => ({
                            ...cur,
                            thresholds: cur.thresholds.map((x, j) =>
                              j === ti ? { ...x, severityLabel: e.target.value || null } : x,
                            ),
                          }))
                        }
                      >
                        <option value="">— severity —</option>
                        {severities.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label={`${base}-th-${ti}-remove`}
                        onClick={() =>
                          patchReasonDictionary(si, ci, ai, ri, (cur) => ({
                            ...cur,
                            thresholds: cur.thresholds.filter((_, j) => j !== ti),
                          }))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    aria-label={`${base}-add-threshold`}
                    onClick={() =>
                      patchReasonDictionary(si, ci, ai, ri, (cur) => ({
                        ...cur,
                        thresholds: [
                          ...cur.thresholds,
                          { whenExpr: "", severityLabel: null, trainingBucketLabel: null },
                        ],
                      }))
                    }
                    style={{ justifySelf: "start" }}
                  >
                    + Add threshold rule
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
