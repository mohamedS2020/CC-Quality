"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAgentAction, updateAgentAction } from "./actions";

export interface AgentFormInitial {
  loginId: number | null;
  agentName: string;
  tlName: string;
  joinDate: string; // yyyy-mm-dd
  active: boolean;
  email: string;
  /** The agent has a login, whose email follows this one (so it can't be blank). */
  hasLogin?: boolean;
}

export function AgentForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial: AgentFormInitial;
}) {
  const router = useRouter();
  const [loginId, setLoginId] = useState(initial.loginId != null ? String(initial.loginId) : "");
  const [agentName, setAgentName] = useState(initial.agentName);
  const [tlName, setTlName] = useState(initial.tlName);
  const [joinDate, setJoinDate] = useState(initial.joinDate);
  const [active, setActive] = useState(initial.active);
  const [email, setEmail] = useState(initial.email);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmit =
    agentName.trim() !== "" &&
    tlName.trim() !== "" &&
    joinDate !== "" &&
    (mode === "edit" || loginId !== "") &&
    (!initial.hasLogin || email.trim() !== "");

  const submit = () => {
    setError(null);
    startTransition(async () => {
      if (mode === "create") {
        const res = await createAgentAction({
          loginId: Number(loginId),
          agentName,
          tlName,
          joinDate,
          email,
        });
        if (res.ok) router.push("/admin/agents");
        else setError(res.message);
      } else {
        const res = await updateAgentAction(initial.loginId!, {
          agentName,
          tlName,
          joinDate,
          active,
          email,
        });
        if (res.ok) router.refresh();
        else setError(res.message);
      }
    });
  };

  return (
    <section style={{ display: "grid", gap: "0.9rem", maxWidth: 460 }}>
      <label className="field">
        <span>Login ID {mode === "create" ? "*" : ""}</span>
        <input
          className="input"
          type="number"
          aria-label="loginId"
          value={loginId}
          disabled={mode === "edit"}
          onChange={(e) => setLoginId(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Agent name *</span>
        <input
          className="input"
          aria-label="agentName"
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Team leader *</span>
        <input
          className="input"
          aria-label="tlName"
          value={tlName}
          onChange={(e) => setTlName(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Join date *</span>
        <input
          className="input"
          type="date"
          aria-label="joinDate"
          value={joinDate}
          onChange={(e) => setJoinDate(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Email{initial.hasLogin ? " *" : ""}</span>
        <input
          className="input"
          type="email"
          aria-label="email"
          placeholder="name@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <span className="muted" style={{ fontSize: "0.8rem" }}>
          {initial.hasLogin
            ? "Score, correction and coaching emails go here. This agent's login email changes with it."
            : "Score, correction and coaching emails go here. Optional; a login account for this agent uses it."}
        </span>
      </label>

      {mode === "edit" && (
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="checkbox"
            aria-label="active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <span>Active</span>
        </label>
      )}

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={submit}
          disabled={!canSubmit || pending}
        >
          {pending ? "Saving…" : mode === "create" ? "Create agent" : "Save changes"}
        </button>
        {error && (
          <span style={{ color: "var(--danger)" }} role="alert">
            {error}
          </span>
        )}
      </div>
    </section>
  );
}
