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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmit =
    agentName.trim() !== "" &&
    tlName.trim() !== "" &&
    joinDate !== "" &&
    (mode === "edit" || loginId !== "");

  const submit = () => {
    setError(null);
    startTransition(async () => {
      if (mode === "create") {
        const res = await createAgentAction({
          loginId: Number(loginId),
          agentName,
          tlName,
          joinDate,
        });
        if (res.ok) router.push("/admin/agents");
        else setError(res.message);
      } else {
        const res = await updateAgentAction(initial.loginId!, {
          agentName,
          tlName,
          joinDate,
          active,
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
