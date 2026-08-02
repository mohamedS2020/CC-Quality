"use client";

import { useState, useTransition } from "react";
import {
  runImportAction,
  validateImportAction,
  type ImportRunResult,
  type ValidateResult,
} from "./actions";

export function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidateResult | null>(null);
  const [result, setResult] = useState<ImportRunResult | null>(null);
  const [pending, startTransition] = useTransition();

  const formData = () => {
    const data = new FormData();
    if (file) data.append("file", file);
    return data;
  };

  const validate = () =>
    startTransition(async () => {
      setResult(null);
      setValidation(await validateImportAction(formData()));
    });

  const runImport = () =>
    startTransition(async () => {
      setResult(await runImportAction(formData()));
    });

  const report = validation?.ok ? validation.validation : null;
  const canImport = !!report && report.ready > 0 && !result?.ok;

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <div>
        <h1 className="page-title" style={{ fontSize: "1.6rem" }}>
          Import evaluations
        </h1>
        <p className="page-sub">
          Upload a CSV or .xlsx (one row per flagged error, grouped by <code>eval_id</code>).
          Validate first to preview problems; scores are derived on import.
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
      </div>

      {validation && !validation.ok && (
        <p role="alert" style={{ color: "var(--danger)" }}>
          {validation.message}
        </p>
      )}

      {report && (
        <div className="card">
          <p style={{ marginTop: 0 }}>
            <strong>{report.ready}</strong> ready · <strong>{report.duplicate}</strong> already
            imported · <strong>{report.errors.length}</strong> error(s)
          </p>
          {report.errors.length > 0 && (
            <ul style={{ margin: "0.25rem 0 0.75rem", paddingLeft: "1.2rem" }}>
              {report.errors.slice(0, 50).map((e, i) => (
                <li key={i}>
                  <code>{e.evalId}</code> — {e.message}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={runImport}
            disabled={!canImport || pending}
          >
            Import {report.ready} evaluation(s)
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
