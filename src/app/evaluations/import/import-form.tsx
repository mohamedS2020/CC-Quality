"use client";

import { useState, useTransition } from "react";
import {
  runImportAction,
  saveReasonAliasesAction,
  validateImportAction,
  type ImportRunResult,
  type ReasonOption,
  type ValidateResult,
} from "./actions";

const encode = (r: ReasonOption) => `${r.attribute}|||${r.reason}`;
const keyOf = (sectionCode: string, sample: string) => `${sectionCode}|||${sample}`;

export function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidateResult | null>(null);
  const [result, setResult] = useState<ImportRunResult | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const formData = () => {
    const data = new FormData();
    if (file) data.append("file", file);
    return data;
  };

  const applyValidation = (v: ValidateResult) => {
    setValidation(v);
    if (v.ok && v.wide) {
      const init: Record<string, string> = {};
      for (const u of v.wide.unmapped) {
        if (u.suggestions[0]) init[keyOf(u.sectionCode, u.sample)] = encode(u.suggestions[0]);
      }
      setSelections(init);
    }
  };

  const validate = () =>
    startTransition(async () => {
      setResult(null);
      applyValidation(await validateImportAction(formData()));
    });

  const runImport = () =>
    startTransition(async () => {
      setResult(await runImportAction(formData()));
    });

  const saveMappings = () =>
    startTransition(async () => {
      if (!(validation?.ok && validation.wide)) return;
      const entries = validation.wide.unmapped.flatMap((u) => {
        const v = selections[keyOf(u.sectionCode, u.sample)];
        if (!v) return [];
        const [attribute, reason] = v.split("|||");
        return [{ sectionCode: u.sectionCode, source: u.sample, attribute, reason }];
      });
      const saved = await saveReasonAliasesAction(entries);
      if (saved.ok) applyValidation(await validateImportAction(formData()));
      else setResult({ ok: false, message: saved.message });
    });

  const report = validation?.ok ? validation.validation : null;
  const wide = validation?.ok ? validation.wide : undefined;
  const hasUnmapped = !!wide && wide.unmapped.length > 0;
  const canImport = !!report && report.ready > 0 && !hasUnmapped && !result?.ok;

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <div>
        <h1 className="page-title" style={{ fontSize: "1.6rem" }}>
          Import evaluations
        </h1>
        <p className="page-sub">
          Upload a CSV or .xlsx. Both layouts are auto-detected: the long format (one row per
          flagged error, grouped by <code>eval_id</code>) and the wide, call-per-row format (a
          column per section holding the flagged reason). Validate first; scores are derived on
          import.
        </p>
      </div>

      <div
        className="card"
        style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}
      >
        <input
          type="file"
          accept=".csv,.xlsx"
          aria-label="import-file"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setValidation(null);
            setResult(null);
          }}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={validate}
          disabled={!file || pending}
        >
          {pending ? "Working…" : "Validate"}
        </button>
        {wide && (
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            Detected call-per-row format · {wide.callCount} calls
          </span>
        )}
      </div>

      {wide && wide.repeatedBasis > 0 && (
        <div className="card" style={{ borderColor: "var(--warning)" }}>
          <strong>
            {wide.repeatedBasis} row{wide.repeatedBasis === 1 ? "" : "s"} repeat another row&apos;s
            details
          </strong>
          <p className="muted" style={{ fontSize: "0.85rem", margin: "0.2rem 0 0" }}>
            Same agent, date, phone number, call type and monitoring type as an earlier row. They
            are imported as <strong>separate calls</strong>, not merged. If any of them is the same
            call entered twice by mistake, remove it from the sheet and re-validate.
          </p>
        </div>
      )}

      {validation && !validation.ok && (
        <p role="alert" style={{ color: "var(--danger)" }}>
          {validation.message}
        </p>
      )}

      {hasUnmapped && wide && (
        <div className="card" style={{ borderColor: "var(--warning)" }}>
          <strong>{wide.unmapped.length} reason(s) need mapping</strong>
          <p className="muted" style={{ fontSize: "0.85rem", margin: "0.15rem 0 0.75rem" }}>
            These source phrases don’t match the config. Pick the matching reason (best guess is
            pre-selected); the mapping is saved so future imports resolve automatically.
          </p>
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {wide.unmapped.map((u) => {
              const k = keyOf(u.sectionCode, u.sample);
              const options =
                wide.reasonOptions.find((o) => o.sectionCode === u.sectionCode)?.options ?? [];
              return (
                <div
                  key={k}
                  style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}
                >
                  <span className="badge">{u.sectionCode}</span>
                  <span style={{ flex: "1 1 220px", minWidth: 0 }}>
                    “{u.sample}” <span className="muted">×{u.count}</span>
                  </span>
                  <span aria-hidden>→</span>
                  <select
                    className="select"
                    aria-label={`map-${k}`}
                    style={{ flex: "1 1 260px", minWidth: 0 }}
                    value={selections[k] ?? ""}
                    onChange={(e) => setSelections((s) => ({ ...s, [k]: e.target.value }))}
                  >
                    <option value="">— choose reason —</option>
                    {options.map((o, i) => (
                      <option key={i} value={encode(o)}>
                        {o.attribute} — {o.reason}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: "0.85rem" }}
            onClick={saveMappings}
            disabled={pending}
          >
            Save mappings &amp; re-validate
          </button>
        </div>
      )}

      {report && (
        <div className="card">
          <p style={{ marginTop: 0 }}>
            <strong>{report.ready}</strong> ready · <strong>{report.duplicate}</strong> already
            imported · <strong>{report.errors.length}</strong> error(s)
          </p>
          {report.errors.length > 0 && (
            <>
              <p className="muted" style={{ fontSize: "0.85rem", margin: "0.25rem 0 0.4rem" }}>
                Row numbers match the uploaded sheet, so you can open it and go straight to the
                line. Nothing is imported until every error is fixed and you re-validate.
              </p>
              <div style={{ overflowX: "auto", marginBottom: "0.75rem" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>Row</th>
                      <th>Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.errors.slice(0, 100).map((e, i) => (
                      <tr key={i}>
                        <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          {e.row != null ? e.row : "—"}
                        </td>
                        <td>{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {report.errors.length > 100 && (
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                  Showing the first 100 of {report.errors.length}.
                </p>
              )}
            </>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={runImport}
            disabled={!canImport || pending}
          >
            {hasUnmapped ? "Map the reasons above first" : `Import ${report.ready} evaluation(s)`}
          </button>
        </div>
      )}

      {result?.ok && (
        <p style={{ color: "var(--success)" }}>
          Imported {result.result.imported}, skipped {result.result.skipped},{" "}
          {result.result.errors.length} error(s).
        </p>
      )}
      {result && !result.ok && (
        <p role="alert" style={{ color: "var(--danger)" }}>
          {result.message}
        </p>
      )}
    </div>
  );
}
