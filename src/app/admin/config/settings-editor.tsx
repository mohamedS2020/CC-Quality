"use client";

import { useState, useTransition } from "react";
import {
  saveCallTypesAction,
  saveCoachingCcAction,
  saveMonitoringTypesAction,
  type SettingsResult,
} from "./settings-actions";

/**
 * Non-versioned operational settings (call types, monitoring types, coaching-email
 * CC), laid out as a dedicated multi-column section. Each list is scrollable (so a long list
 * doesn't stretch the page) with inline "value + delete" rows, and saves
 * immediately via its own action — no new config version is created.
 */

function Status({ result }: { result: SettingsResult | null }) {
  if (!result) return null;
  return result.ok ? (
    <span style={{ color: "var(--success)", fontSize: "0.85rem" }}>Saved ✓</span>
  ) : (
    <span style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{result.message}</span>
  );
}

function EditableList({
  items,
  onChange,
  placeholder,
  idPrefix,
  emptyText,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  idPrefix: string;
  emptyText: string;
}) {
  return (
    <>
      <div
        style={{
          maxHeight: 300,
          overflowY: "auto",
          display: "grid",
          gap: "0.4rem",
          border: "0.5px solid var(--border)",
          borderRadius: 8,
          padding: "0.5rem",
          background: "var(--surface-1)",
        }}
      >
        {items.length === 0 ? (
          <p className="muted" style={{ margin: "0.25rem", fontSize: "0.85rem" }}>
            {emptyText}
          </p>
        ) : (
          items.map((value, i) => (
            <div key={i} style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <input
                className="input"
                style={{ flex: 1, minWidth: 0 }}
                aria-label={`${idPrefix}-${i}`}
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                aria-label={`${idPrefix}-${i}-remove`}
                style={{ flexShrink: 0 }}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        style={{ marginTop: "0.5rem", width: "fit-content" }}
        aria-label={`add-${idPrefix}`}
        onClick={() => onChange([...items, ""])}
      >
        + Add
      </button>
    </>
  );
}

function Panel({
  title,
  subtitle,
  count,
  onSave,
  saving,
  result,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  onSave: () => void;
  saving: boolean;
  result: SettingsResult | null;
  children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ display: "grid", gap: "0.6rem", alignContent: "start" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <strong>{title}</strong>
        <span className="muted" style={{ fontSize: "0.8rem" }}>
          {count} item{count === 1 ? "" : "s"}
        </span>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
        {subtitle}
      </p>
      {children}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.15rem" }}>
        <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={onSave}>
          Save
        </button>
        <Status result={result} />
      </div>
    </div>
  );
}

export function SettingsEditor({
  initialCallTypes,
  initialMonitoringTypes,
  initialCoachingCc,
}: {
  initialCallTypes: string[];
  initialMonitoringTypes: string[];
  initialCoachingCc: string[];
}) {
  const [callTypes, setCallTypes] = useState(initialCallTypes);
  const [monitoringTypes, setMonitoringTypes] = useState(initialMonitoringTypes);
  const [mtResult, setMtResult] = useState<SettingsResult | null>(null);
  const [cc, setCc] = useState(initialCoachingCc);
  const [ctResult, setCtResult] = useState<SettingsResult | null>(null);
  const [ccResult, setCcResult] = useState<SettingsResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <section
      style={{
        marginBottom: "2rem",
        borderBottom: "1px solid var(--border)",
        paddingBottom: "1.75rem",
      }}
    >
      <h2 className="page-title" style={{ fontSize: "1.35rem" }}>
        Operational settings
      </h2>
      <p className="page-sub" style={{ marginBottom: "1.25rem" }}>
        Editable lists that save immediately and never create a new config version.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1.25rem",
          alignItems: "start",
        }}
      >
        <Panel
          title="Call types"
          subtitle="Options in the evaluation form’s Call type dropdown."
          count={callTypes.length}
          saving={pending}
          result={ctResult}
          onSave={() => start(async () => setCtResult(await saveCallTypesAction(callTypes)))}
        >
          <EditableList
            items={callTypes}
            onChange={(v) => {
              setCallTypes(v);
              setCtResult(null);
            }}
            placeholder="e.g. Facility Request"
            idPrefix="callType"
            emptyText="No call types yet."
          />
        </Panel>

        <Panel
          title="Monitoring types"
          subtitle="Options in the evaluation form’s Monitoring type dropdown, in this order."
          count={monitoringTypes.length}
          saving={pending}
          result={mtResult}
          onSave={() =>
            start(async () => setMtResult(await saveMonitoringTypesAction(monitoringTypes)))
          }
        >
          <EditableList
            items={monitoringTypes}
            onChange={(v) => {
              setMonitoringTypes(v);
              setMtResult(null);
            }}
            placeholder="e.g. Agent Level"
            idPrefix="monitoringType"
            emptyText="No monitoring types yet."
          />
        </Panel>

        <Panel
          title="Coaching email — CC"
          subtitle="Extra recipients CC’d on every coaching email."
          count={cc.length}
          saving={pending}
          result={ccResult}
          onSave={() => start(async () => setCcResult(await saveCoachingCcAction(cc)))}
        >
          <EditableList
            items={cc}
            onChange={(v) => {
              setCc(v);
              setCcResult(null);
            }}
            placeholder="name@company.com"
            idPrefix="coachingCc"
            emptyText="No CC recipients yet."
          />
        </Panel>
      </div>
    </section>
  );
}
