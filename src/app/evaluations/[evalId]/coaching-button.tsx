"use client";

import { useState, useTransition } from "react";
import { sendCoachingEmailAction } from "./coaching-actions";

/** "Send coaching email" for a failed call — pops up for the coaching text, then sends. */
export function CoachingButton({ evalId }: { evalId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const result = await sendCoachingEmailAction(evalId, text);
      if (result.ok) {
        setOpen(false); // page revalidates → the "Coaching sent" mark replaces this button
      } else {
        setError(result.message);
      }
    });

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: "1.25rem" }}
        onClick={() => setOpen(true)}
      >
        Send coaching email
      </button>
    );
  }

  return (
    <div
      className="card"
      style={{ marginTop: "1.25rem", maxWidth: 540, display: "grid", gap: "0.6rem" }}
    >
      <strong>Coaching message to the agent</strong>
      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        This is added to the coaching email (with the call data and failed sections) and recorded.
      </p>
      <textarea
        className="input"
        aria-label="coaching-text"
        rows={4}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        placeholder="Write the coaching guidance for the agent…"
      />
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={pending || text.trim() === ""}
          onClick={submit}
        >
          {pending ? "Sending…" : "Send"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </button>
        {error && <span style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</span>}
      </div>
    </div>
  );
}
