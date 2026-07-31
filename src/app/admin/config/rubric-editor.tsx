"use client";

import type {
  AttributeInput,
  CategoryInput,
  ErrorReasonInput,
  SectionInput,
} from "@/lib/config/input";

export const emptyCategory = (): CategoryInput => ({ label: "", attributes: [] });
export const emptyAttribute = (): AttributeInput => ({ label: "", errorReasons: [] });
export const emptyErrorReason = (): ErrorReasonInput => ({ label: "", dictionary: null });

const input: React.CSSProperties = {
  padding: "0.35rem 0.5rem",
  borderRadius: 6,
  border: "1px solid var(--border, #ccc)",
  background: "var(--background, #fff)",
  color: "inherit",
  flex: 1,
  minWidth: 160,
};
const row: React.CSSProperties = { display: "flex", gap: "0.5rem", alignItems: "center" };
const sectionBox: React.CSSProperties = {
  border: "1px solid var(--border, #ccc)",
  borderRadius: 8,
  padding: "0.75rem 1rem 1rem",
};
const categoryBox: React.CSSProperties = {
  borderLeft: "3px solid var(--border, #ccc)",
  paddingLeft: "0.75rem",
  margin: "0.75rem 0",
  display: "grid",
  gap: "0.5rem",
};
const attributeBox: React.CSSProperties = {
  borderLeft: "2px dashed var(--border, #ddd)",
  paddingLeft: "0.75rem",
  marginLeft: "0.5rem",
  display: "grid",
  gap: "0.4rem",
};
const reasonRow: React.CSSProperties = { ...row, marginLeft: "1rem" };

export function RubricEditor({
  sections,
  onChange,
}: {
  sections: SectionInput[];
  onChange: (next: SectionInput[]) => void;
}) {
  const patchCategories = (si: number, updater: (cats: CategoryInput[]) => CategoryInput[]) =>
    onChange(sections.map((s, i) => (i === si ? { ...s, categories: updater(s.categories) } : s)));

  const patchAttributes = (
    si: number,
    ci: number,
    updater: (attrs: AttributeInput[]) => AttributeInput[],
  ) =>
    patchCategories(si, (cats) =>
      cats.map((c, i) => (i === ci ? { ...c, attributes: updater(c.attributes) } : c)),
    );

  const patchReasons = (
    si: number,
    ci: number,
    ai: number,
    updater: (reasons: ErrorReasonInput[]) => ErrorReasonInput[],
  ) =>
    patchAttributes(si, ci, (attrs) =>
      attrs.map((a, i) => (i === ai ? { ...a, errorReasons: updater(a.errorReasons) } : a)),
    );

  if (sections.length === 0) {
    return (
      <p style={{ color: "var(--muted)" }}>
        Add sections first (Sections tab), then build their rubric here.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      {sections.map((section, si) => (
        <fieldset key={si} style={sectionBox} data-testid="rubric-section">
          <legend style={{ fontWeight: 600 }}>
            {section.code || "(no code)"} — {section.label || "(no label)"} ·{" "}
            {section.categories.reduce((n, c) => n + c.attributes.length, 0)} attribute(s)
          </legend>

          {section.categories.map((category, ci) => (
            <div key={ci} style={categoryBox} data-testid="rubric-category">
              <div style={row}>
                <input
                  style={input}
                  placeholder="Category label"
                  aria-label={`s${si}-c${ci}-label`}
                  value={category.label}
                  onChange={(e) =>
                    patchCategories(si, (cats) =>
                      cats.map((c, i) => (i === ci ? { ...c, label: e.target.value } : c)),
                    )
                  }
                />
                <button
                  type="button"
                  aria-label={`s${si}-c${ci}-remove`}
                  onClick={() => patchCategories(si, (cats) => cats.filter((_, i) => i !== ci))}
                >
                  Remove category
                </button>
              </div>

              {category.attributes.map((attribute, ai) => (
                <div key={ai} style={attributeBox} data-testid="rubric-attribute">
                  <div style={row}>
                    <input
                      style={input}
                      placeholder="Attribute label"
                      aria-label={`s${si}-c${ci}-a${ai}-label`}
                      value={attribute.label}
                      onChange={(e) =>
                        patchAttributes(si, ci, (attrs) =>
                          attrs.map((a, i) => (i === ai ? { ...a, label: e.target.value } : a)),
                        )
                      }
                    />
                    <button
                      type="button"
                      aria-label={`s${si}-c${ci}-a${ai}-remove`}
                      onClick={() =>
                        patchAttributes(si, ci, (attrs) => attrs.filter((_, i) => i !== ai))
                      }
                    >
                      Remove attribute
                    </button>
                  </div>

                  {attribute.errorReasons.map((reason, ri) => (
                    <div key={ri} style={reasonRow} data-testid="rubric-reason">
                      <input
                        style={input}
                        placeholder="Error reason"
                        aria-label={`s${si}-c${ci}-a${ai}-r${ri}-label`}
                        value={reason.label}
                        onChange={(e) =>
                          patchReasons(si, ci, ai, (reasons) =>
                            reasons.map((r, i) => (i === ri ? { ...r, label: e.target.value } : r)),
                          )
                        }
                      />
                      <button
                        type="button"
                        aria-label={`s${si}-c${ci}-a${ai}-r${ri}-remove`}
                        onClick={() =>
                          patchReasons(si, ci, ai, (reasons) => reasons.filter((_, i) => i !== ri))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    aria-label={`s${si}-c${ci}-a${ai}-add-reason`}
                    onClick={() =>
                      patchReasons(si, ci, ai, (reasons) => [...reasons, emptyErrorReason()])
                    }
                  >
                    + Add error reason
                  </button>
                </div>
              ))}

              <button
                type="button"
                aria-label={`s${si}-c${ci}-add-attr`}
                onClick={() => patchAttributes(si, ci, (attrs) => [...attrs, emptyAttribute()])}
              >
                + Add attribute
              </button>
            </div>
          ))}

          <button
            type="button"
            aria-label={`s${si}-add-cat`}
            onClick={() => patchCategories(si, (cats) => [...cats, emptyCategory()])}
          >
            + Add category
          </button>
        </fieldset>
      ))}
    </div>
  );
}
