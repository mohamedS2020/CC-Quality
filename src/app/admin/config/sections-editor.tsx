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

const card: React.CSSProperties = {
  border: "1px solid var(--border, #ccc)",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "0.75rem",
  display: "grid",
  gap: "0.6rem",
};

const row: React.CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
  alignItems: "center",
};
const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.2rem" };
const input: React.CSSProperties = {
  padding: "0.4rem 0.5rem",
  borderRadius: 6,
  border: "1px solid var(--border, #ccc)",
  background: "var(--background, #fff)",
  color: "inherit",
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
          style={{ color: rankOk ? "var(--success, #2e7d32)" : "var(--danger, #c0392b)" }}
        >
          Rank weight total: {rankTotal}
          {rankOk ? " ✓" : ` (must be ${RANK_WEIGHT_TOTAL})`}
        </span>
      </div>

      {sections.length === 0 && (
        <p style={{ color: "var(--muted)" }}>No sections yet. Add the first one below.</p>
      )}

      {sections.map((section, i) => (
        <div key={i} style={card} data-testid="section-card">
          <div style={row}>
            <label style={field}>
              <span>Code</span>
              <input
                style={{ ...input, width: 90 }}
                aria-label={`section-${i}-code`}
                value={section.code}
                onChange={(e) => update(i, { code: e.target.value })}
              />
            </label>
            <label style={{ ...field, flex: 1, minWidth: 160 }}>
              <span>Label</span>
              <input
                style={input}
                aria-label={`section-${i}-label`}
                value={section.label}
                onChange={(e) => update(i, { label: e.target.value })}
              />
            </label>
            <label style={field}>
              <span>Scoring mode</span>
              <select
                style={input}
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
              style={{ fontSize: "0.85rem", color: "var(--muted)" }}
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
            <label style={field}>
              <span>Rank weight</span>
              <input
                style={{ ...input, width: 100 }}
                type="number"
                aria-label={`section-${i}-rankWeight`}
                value={section.rankWeight}
                onChange={(e) => update(i, { rankWeight: toNumber(e.target.value) })}
              />
            </label>
            <label style={field}>
              <span>Rank benchmark (0–1)</span>
              <input
                style={{ ...input, width: 120 }}
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
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`section-${i}-up`}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === sections.length - 1}
                aria-label={`section-${i}-down`}
              >
                ↓
              </button>
              <button type="button" onClick={() => remove(i)} aria-label={`section-${i}-remove`}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={add}>
        + Add section
      </button>
    </section>
  );
}
