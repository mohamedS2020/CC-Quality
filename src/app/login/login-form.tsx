"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "./actions";

const initialState: LoginFormState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} noValidate style={{ display: "grid", gap: "0.9rem" }}>
      <label className="field">
        <span>Email</span>
        <input
          className="input"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="you@company.com"
        />
      </label>

      <label className="field">
        <span>Password</span>
        <input
          className="input"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </label>

      {state.error && (
        <p role="alert" style={{ color: "var(--danger)", fontSize: "0.9rem", margin: 0 }}>
          {state.error}
        </p>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={pending}
        style={{ width: "100%", marginTop: "0.25rem" }}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
