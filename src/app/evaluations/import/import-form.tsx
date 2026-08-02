"use client";

import { useState, useTransition } from "react";
import {
  runImportAction,
  validateImportAction,
  type ImportRunResult,
  type ValidateResult,
} from "./actions";

const box: React.CSSProperties = {
  border: "1px solid var(--border, #ccc)",
  borderRadius: 8,
  padding: "1rem",
};
const button: React.CSSProperties = {
  padding: "0.5rem 0.9rem",
  borderRadius: 6,
  border: "none",
  background: "var(--accent, #2563eb)",
  color: "#fff",
  cursor: "pointer",
};

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
        <h1 style={{ fontSize: "1.6rem", marginBottom: "0.25rem" }}>Import evaluations</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Upload a CSV or .xlsx (one row per flagged error, grouped by <code>eval_id</code>).
          Validate first to preview problems; scores are derived on import.
        </p>
      </div>

      <div
        style={{ ...box, display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}
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
          onClick={validate}
          disabled={!file || pending}
          style={{ ...button, opacity: !file || pending ? 0.6 : 1 }}
        >
          {pending ? "Working…" : "Validate"}
        </button>
      </div>

      {validation && !validation.ok && (
        <p role="alert" style={{ color: "var(--danger, #c0392b)" }}>
          {validation.message}
        </p>
      )}

      {report && (
        <div style={box}>
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
            onClick={runImport}
            disabled={!canImport || pending}
            style={{ ...button, opacity: !canImport || pending ? 0.6 : 1 }}
          >
            Import {report.ready} evaluation(s)
          </button>
        </div>
      )}

      {result?.ok && (
        <p style={{ color: "var(--success, #2e7d32)" }}>
          Imported {result.result.imported}, skipped {result.result.skipped},{" "}
          {result.result.errors.length} error(s).
        </p>
      )}
      {result && !result.ok && (
        <p role="alert" style={{ color: "var(--danger, #c0392b)" }}>
          {result.message}
        </p>
      )}
    </div>
  );
}
