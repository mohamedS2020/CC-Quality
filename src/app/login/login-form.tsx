"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "./actions";

const initialState: LoginFormState = { error: null };

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  marginBottom: "1rem",
};

const inputStyle: React.CSSProperties = {
  padding: "0.55rem 0.65rem",
  borderRadius: 6,
  border: "1px solid var(--border, #ccc)",
  background: "var(--background, #fff)",
  color: "inherit",
  fontSize: "1rem",
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} noValidate>
      <label style={fieldStyle}>
        <span>Email</span>
        <input name="email" type="email" autoComplete="username" required style={inputStyle} />
      </label>

      <label style={fieldStyle}>
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          style={inputStyle}
        />
      </label>

      {state.error && (
        <p role="alert" style={{ color: "var(--danger, #c0392b)", marginBottom: "1rem" }}>
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{
          width: "100%",
          padding: "0.6rem",
          borderRadius: 6,
          border: "none",
          background: "var(--accent, #2563eb)",
          color: "#fff",
          fontSize: "1rem",
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
