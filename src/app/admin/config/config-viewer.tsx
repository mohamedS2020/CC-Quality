import type { LoadedConfig, LoadedSection } from "@/lib/config/loader";
import { isLensProvisional } from "@/lib/engine/lenses";

/**
 * Read-only presentation of a configuration version (FR-28) for holders of
 * `config.view` who cannot edit. Consumes the LoadedConfig directly (server
 * component), so its lookup Maps are used as-is without serialization.
 */

const card: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "1rem 1.15rem",
};
const h2: React.CSSProperties = { fontSize: "1.15rem", margin: "0 0 0.75rem" };
const badge: React.CSSProperties = {
  fontSize: "0.75rem",
  padding: "0.1rem 0.5rem",
  borderRadius: 999,
  border: "1px solid var(--border)",
  color: "var(--muted)",
};
const activeBadge: React.CSSProperties = {
  color: "var(--success, #16a34a)",
  borderColor: "var(--success, #16a34a)",
};
const provBadge: React.CSSProperties = {
  fontSize: "0.72rem",
  padding: "0.05rem 0.45rem",
  borderRadius: 999,
  background: "var(--accent-soft)",
  color: "var(--nav-active-fg)",
};
const codeChip: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "0.8rem",
  color: "var(--muted)",
};
const meta: React.CSSProperties = {
  display: "flex",
  gap: "0.9rem",
  flexWrap: "wrap",
  color: "var(--muted)",
  fontSize: "0.83rem",
  margin: "0.4rem 0 0.75rem",
};

const pct = (v: number) => `${Number((v * 100).toFixed(2))}%`;
const humanize = (s: string) => {
  const t = s.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem 0.75rem" }}>
      <div style={{ color: "var(--muted)", fontSize: "0.76rem" }}>{label}</div>
      <div style={{ fontSize: "1.05rem", fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function SectionCard({ section }: { section: LoadedSection }) {
  return (
    <div style={card}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", flexWrap: "wrap" }}>
        <strong style={{ fontSize: "1.05rem" }}>{section.code}</strong>
        <span>{section.label}</span>
      </div>
      <div style={meta}>
        <span>{humanize(section.scoringMode)}</span>
        {section.critical && <span>critical</span>}
        {section.capPerAttribute && <span>cap per attribute</span>}
        <span>weight {section.rankWeight}</span>
        <span>benchmark {pct(section.rankBenchmark)}</span>
        <span>{section.attributeCount} attributes</span>
      </div>
      {section.categories.map((c) => (
        <div key={c.id} style={{ margin: "0.4rem 0 0.4rem 0.25rem" }}>
          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{c.label}</div>
          {c.attributes.map((a) => (
            <div key={a.id} style={{ margin: "0.3rem 0 0.3rem 0.75rem" }}>
              <div style={{ fontStyle: "italic", color: "var(--muted)", fontSize: "0.85rem" }}>
                {a.label}
              </div>
              <ul style={{ margin: "0.2rem 0 0 0.5rem", paddingLeft: "1rem" }}>
                {a.errorReasons.map((r) => {
                  const tags = r.dictionary
                    ? [r.dictionary.severity, r.dictionary.trainingBucket].filter(Boolean)
                    : [];
                  return (
                    <li key={r.id} style={{ fontSize: "0.9rem" }}>
                      {r.label}
                      {tags.length > 0 && (
                        <span style={{ color: "var(--muted)" }}> — {tags.join(" · ")}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ConfigViewer({ config }: { config: LoadedConfig }) {
  return (
    <div style={{ display: "grid", gap: "1.75rem" }}>
      <header>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "1.6rem", margin: 0 }}>{config.name}</h1>
          <span style={badge}>Version {config.version}</span>
          {config.isActive && <span style={{ ...badge, ...activeBadge }}>Active</span>}
        </div>
        <p style={{ color: "var(--muted)", margin: "0.35rem 0 0" }}>
          Read-only view of the scorecard configuration. Editing requires the “Edit configuration”
          permission.
        </p>
      </header>

      <section>
        <h2 style={h2}>Policy</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <Stat label="Published decimals" value={config.roundingDecimals} />
          <Stat label="Pareto cutoff" value={pct(config.paretoCutoff)} />
          <Stat label="New-agent tenure" value={`${config.newAgentTenureDays} days`} />
          <Stat label="Trial window" value={`${config.trialWindowDays} days`} />
        </div>
      </section>

      <section>
        <h2 style={h2}>Sections &amp; rubric</h2>
        <div style={{ display: "grid", gap: "1rem" }}>
          {config.sections.map((s) => (
            <SectionCard key={s.id} section={s} />
          ))}
        </div>
      </section>

      <section>
        <h2 style={h2}>Lenses &amp; benchmarks</h2>
        {config.lenses.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No lenses configured.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {config.lenses.map((lens) => (
              <div key={lens.id} style={card}>
                <div
                  style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}
                >
                  <strong>{lens.label}</strong>
                  <code style={codeChip}>{lens.key}</code>
                  <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                    {humanize(lens.basis)}
                  </span>
                  {isLensProvisional(lens.basis) && <span style={provBadge}>provisional</span>}
                </div>
                <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem", fontSize: "0.9rem" }}>
                  {[...lens.benchmarks.entries()].map(([sectionId, threshold]) => (
                    <li key={sectionId}>
                      <span style={{ color: "var(--muted)" }}>
                        {config.sectionById.get(sectionId)?.code ?? `#${sectionId}`}
                      </span>{" "}
                      ≥ {pct(threshold)}
                    </li>
                  ))}
                  {lens.benchmarks.size === 0 && (
                    <li style={{ color: "var(--muted)" }}>No benchmarks.</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={h2}>Dictionary</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
          }}
        >
          <div style={card}>
            <div style={{ fontWeight: 600, marginBottom: "0.4rem" }}>Severities</div>
            {config.severities.length === 0 ? (
              <span style={{ color: "var(--muted)" }}>None defined.</span>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {config.severities.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </div>
          <div style={card}>
            <div style={{ fontWeight: 600, marginBottom: "0.4rem" }}>Training buckets</div>
            {config.trainingBuckets.length === 0 ? (
              <span style={{ color: "var(--muted)" }}>None defined.</span>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {config.trainingBuckets.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
