"use client";

import { useState, useTransition } from "react";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { setPermissionsAction } from "./actions";

/**
 * Per-Moderator permission toggles (FR-8). Only shown for Moderators — Admins
 * hold every permission implicitly and Agents have a fixed self-scope set, so
 * neither is grant-driven. Saved grants take effect on the user's next request.
 */
export function PermissionEditor({
  userId,
  initialKeys,
}: {
  userId: number;
  initialKeys: string[];
}) {
  const [granted, setGranted] = useState<Set<string>>(new Set(initialKeys));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (key: string) => {
    setSaved(false);
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await setPermissionsAction(userId, [...granted]);
      if (res.ok) setSaved(true);
      else setError(res.message);
    });
  };

  return (
    <section style={{ display: "grid", gap: "0.6rem" }}>
      <p style={{ color: "var(--muted)", margin: 0 }}>
        Grant exactly the actions this Moderator may perform. Changes apply on their next request.
      </p>
      <div style={{ display: "grid", gap: "0.4rem" }}>
        {PERMISSIONS.map((p) => (
          <label key={p.key} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
            <input
              type="checkbox"
              aria-label={p.key}
              checked={granted.has(p.key)}
              onChange={() => toggle(p.key)}
            />
            <span>
              <strong>{p.label}</strong>
              <span style={{ color: "var(--muted)" }}> — {p.description}</span>
            </span>
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          style={{
            padding: "0.45rem 0.9rem",
            borderRadius: 6,
            border: "1px solid var(--border, #ccc)",
            background: "transparent",
            color: "inherit",
            cursor: pending ? "default" : "pointer",
          }}
        >
          {pending ? "Saving…" : "Save permissions"}
        </button>
        {saved && <span style={{ color: "var(--success, #2e7d32)" }}>Saved.</span>}
        {error && (
          <span style={{ color: "var(--danger, #c0392b)" }} role="alert">
            {error}
          </span>
        )}
      </div>
    </section>
  );
}
