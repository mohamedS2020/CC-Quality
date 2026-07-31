"use client";

import type { LensBasis } from "@prisma/client";
import type { LensInput } from "@/lib/config/input";

const BASES: { value: LensBasis; label: string }[] = [
  { value: "PER_ERROR", label: "Per error — every error counts" },
  { value: "PER_SCORESHEET", label: "Per score sheet" },
  { value: "FAILED_SCORESHEETS", label: "Failed scorecards" },
];

const DEFAULT_BENCHMARK = 0.95;

export function emptyLens(sectionCodes: string[]): LensInput {
  return {
    key: "",
    label: "",
    basis: "PER_ERROR",
    benchmarks: sectionCodes.map((code) => ({ sectionCode: code, threshold: DEFAULT_BENCHMARK })),
  };
}

const card: React.CSSProperties = {
  border: "1px solid var(--border, #ccc)",
  borderRadius: 8,
  padding: "1rem",
  display: "grid",
  gap: "0.75rem",
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
const grid: React.CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
  marginTop: "0.4rem",
};

function benchmarkValue(lens: LensInput, code: string): string {
  const b = lens.benchmarks.find((x) => x.sectionCode === code);
  return b ? String(b.threshold) : "";
}

export function LensesEditor({
  lenses,
  sectionCodes,
  onChange,
}: {
  lenses: LensInput[];
  sectionCodes: string[];
  onChange: (next: LensInput[]) => void;
}) {
  const update = (index: number, patch: Partial<LensInput>) =>
    onChange(lenses.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const remove = (index: number) => onChange(lenses.filter((_, i) => i !== index));

  const add = () => onChange([...lenses, emptyLens(sectionCodes)]);

  const setBenchmark = (index: number, code: string, valueStr: string) => {
    const lens = lenses[index];
    let benchmarks;
    if (valueStr.trim() === "") {
      benchmarks = lens.benchmarks.filter((b) => b.sectionCode !== code);
    } else {
      const threshold = Number(valueStr);
      benchmarks = lens.benchmarks.some((b) => b.sectionCode === code)
        ? lens.benchmarks.map((b) => (b.sectionCode === code ? { ...b, threshold } : b))
        : [...lens.benchmarks, { sectionCode: code, threshold }];
    }
    update(index, { benchmarks });
  };

  if (sectionCodes.length === 0) {
    return (
      <p style={{ color: "var(--muted)" }}>
        Add sections first, then define lenses and their per-section benchmarks here.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <p style={{ color: "var(--muted)", margin: 0 }}>
        Rank weights &amp; benchmarks are set per section in the Sections tab. Each lens needs a
        benchmark for every section.
      </p>

      {lenses.map((lens, i) => (
        <div key={i} style={card} data-testid="lens-card">
          <div style={row}>
            <label style={field}>
              <span>Key</span>
              <input
                style={{ ...input, width: 120 }}
                aria-label={`lens-${i}-key`}
                value={lens.key}
                onChange={(e) => update(i, { key: e.target.value })}
              />
            </label>
            <label style={{ ...field, flex: 1, minWidth: 160 }}>
              <span>Label</span>
              <input
                style={input}
                aria-label={`lens-${i}-label`}
                value={lens.label}
                onChange={(e) => update(i, { label: e.target.value })}
              />
            </label>
            <label style={field}>
              <span>Basis</span>
              <select
                style={input}
                aria-label={`lens-${i}-basis`}
                value={lens.basis}
                onChange={(e) => update(i, { basis: e.target.value as LensBasis })}
              >
                {BASES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              aria-label={`lens-${i}-remove`}
              onClick={() => remove(i)}
              style={{ marginLeft: "auto" }}
            >
              Remove lens
            </button>
          </div>

          <div>
            <strong style={{ fontSize: "0.9rem" }}>Benchmarks (0–1) per section</strong>
            <div style={grid}>
              {sectionCodes.map((code) => (
                <label key={code} style={field}>
                  <span>{code || "(no code)"}</span>
                  <input
                    style={{ ...input, width: 100 }}
                    type="number"
                    step="0.001"
                    aria-label={`lens-${i}-bench-${code}`}
                    value={benchmarkValue(lens, code)}
                    onChange={(e) => setBenchmark(i, code, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={add}>
        + Add lens
      </button>
    </div>
  );
}
