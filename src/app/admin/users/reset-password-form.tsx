"use client";

import { useState, useTransition } from "react";
import { resetPasswordAction } from "./actions";

/** Admin-initiated password reset (FR-1): sets a new password and logs the user out. */
export function ResetPasswordForm({ userId }: { userId: number }) {
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    setDone(false);
    startTransition(async () => {
      const res = await resetPasswordAction(userId, password);
      if (res.ok) {
        setDone(true);
        setPassword("");
      } else {
        setError(res.message);
      }
    });
  };

  return (
    <section style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
      <label className="field" style={{ minWidth: 220 }}>
        <span>New password</span>
        <input
          className="input"
          type="password"
          aria-label="newPassword"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={submit}
        disabled={pending || password === ""}
      >
        {pending ? "Resetting…" : "Reset password"}
      </button>
      {done && (
        <span style={{ color: "var(--success, #2e7d32)" }}>
          Password reset — the user must sign in again.
        </span>
      )}
      {error && (
        <span style={{ color: "var(--danger, #c0392b)" }} role="alert">
          {error}
        </span>
      )}
    </section>
  );
}
