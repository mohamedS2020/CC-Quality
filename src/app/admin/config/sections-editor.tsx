"use client";

import type { ScoringMode } from "@prisma/client";
import type { SectionInput } from "@/lib/config/input";

const SCORING_MODES: { value: ScoringMode; label: string }[] = [
  { value: "SECTION_BINARY", label: "Binary — any error fails the section" },
  { value: "GRADED_ATTRIBUTES", label: "Graded — accuracy across attributes" },
];

const RANK_WEIGHT_TOTAL = 100;

export function emptySection(): SectionInput {
  return {
    code: "",
    label: "",
    scoringMode: "SECTION_BINARY",
    critical: false,
    capPerAttribute: false,
    rankWeight: 0,
    rankBenchmark: 0,
    categories: [],
  };
}

const row: React.CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
  alignItems: "center",
};

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** The graded denominator (attributes per call) — DERIVED from the rubric (FR-32). */
function attributeCountOf(section: SectionInput): number {
  return section.categories.reduce((n, c) => n + c.attributes.length, 0);
}

export function SectionsEditor({
  sections,
  onChange,
}: {
  sections: SectionInput[];
  onChange: (next: SectionInput[]) => void;
}) {
  const update = (index: number, patch: Partial<SectionInput>) =>
    onChange(sections.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const remove = (index: number) => onChange(sections.filter((_, i) => i !== index));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const add = () => onChange([...sections, emptySection()]);

  const rankTotal = sections.reduce((sum, s) => sum + (Number(s.rankWeight) || 0), 0);
  const rankOk = Math.abs(rankTotal - RANK_WEIGHT_TOTAL) < 1e-6;

  return (
    <section>
      <div style={{ ...row, justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Sections</h2>
        <span
          data-testid="rank-total"
          className={rankOk ? "badge badge-success" : "badge badge-danger"}
        >
          Rank weight total: {rankTotal}
          {rankOk ? " ✓" : ` (must be ${RANK_WEIGHT_TOTAL})`}
        </span>
      </div>

      {sections.length === 0 && <p className="muted">No sections yet. Add the first one below.</p>}

      <div style={{ display: "grid", gap: "0.75rem" }}>
        {sections.map((section, i) => (
          <div
            key={i}
            className="card"
            data-testid="section-card"
            style={{ display: "grid", gap: "0.6rem" }}
          >
            <div style={row}>
              <label className="field">
                <span>Code</span>
                <input
                  className="input"
                  style={{ width: 90 }}
                  aria-label={`section-${i}-code`}
                  value={section.code}
                  onChange={(e) => update(i, { code: e.target.value })}
                />
              </label>
              <label className="field" style={{ flex: 1, minWidth: 160 }}>
                <span>Label</span>
                <input
                  className="input"
                  aria-label={`section-${i}-label`}
                  value={section.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Scoring mode</span>
                <select
                  className="select"
                  aria-label={`section-${i}-scoringMode`}
                  value={section.scoringMode}
                  onChange={(e) => update(i, { scoringMode: e.target.value as ScoringMode })}
                >
                  {SCORING_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {section.scoringMode === "GRADED_ATTRIBUTES" && (
              <div
                data-testid={`section-${i}-denominator`}
                className="muted"
                style={{ fontSize: "0.85rem" }}
              >
                Attributes per call (denominator): <strong>{attributeCountOf(section)}</strong> —
                derived from the rubric, read-only (FR-32).
              </div>
            )}

            <div style={row}>
              <label style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                <input
                  type="checkbox"
                  aria-label={`section-${i}-critical`}
                  checked={section.critical}
                  onChange={(e) => update(i, { critical: e.target.checked })}
                />
                <span>Critical (feeds sum of criticals)</span>
              </label>
              <label style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                <input
                  type="checkbox"
                  aria-label={`section-${i}-capPerAttribute`}
                  checked={section.capPerAttribute}
                  onChange={(e) => update(i, { capPerAttribute: e.target.checked })}
                />
                <span>Cap per attribute (graded)</span>
              </label>
            </div>

            <div style={row}>
              <label className="field">
                <span>Rank weight</span>
                <input
                  className="input"
                  style={{ width: 100 }}
                  type="number"
                  aria-label={`section-${i}-rankWeight`}
                  value={section.rankWeight}
                  onChange={(e) => update(i, { rankWeight: toNumber(e.target.value) })}
                />
              </label>
              <label className="field">
                <span>Rank benchmark (0–1)</span>
                <input
                  className="input"
                  style={{ width: 120 }}
                  type="number"
                  step="0.001"
                  aria-label={`section-${i}-rankBenchmark`}
                  value={section.rankBenchmark}
                  onChange={(e) => update(i, { rankBenchmark: toNumber(e.target.value) })}
                />
              </label>

              <div style={{ ...row, marginLeft: "auto" }}>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`section-${i}-up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => move(i, 1)}
                  disabled={i === sections.length - 1}
                  aria-label={`section-${i}-down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => remove(i)}
                  aria-label={`section-${i}-remove`}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-sm btn-ghost"
        style={{ marginTop: "0.75rem" }}
        onClick={add}
      >
        + Add section
      </button>
    </section>
  );
}
