"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { createUserAction, updateUserAction } from "./actions";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "MODERATOR", label: "Moderator" },
  { value: "AGENT", label: "Agent" },
];

export interface UserFormInitial {
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  agentLoginId: number | null;
}

export function UserForm({
  mode,
  userId,
  initial,
  agents,
}: {
  mode: "create" | "edit";
  userId?: number;
  initial: UserFormInitial;
  agents: { loginId: number; agentName: string }[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initial.email);
  const [name, setName] = useState(initial.name);
  const [role, setRole] = useState<UserRole>(initial.role);
  const [active, setActive] = useState(initial.active);
  const [agentLoginId, setAgentLoginId] = useState(
    initial.agentLoginId != null ? String(initial.agentLoginId) : "",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const needsAgent = role === "AGENT";
  const canSubmit =
    name.trim() !== "" &&
    (mode === "edit" || (email.trim() !== "" && password !== "")) &&
    (!needsAgent || agentLoginId !== "");

  const submit = () => {
    setError(null);
    const agentId = needsAgent && agentLoginId !== "" ? Number(agentLoginId) : null;
    startTransition(async () => {
      if (mode === "create") {
        const res = await createUserAction({ email, name, role, agentLoginId: agentId, password });
        if (res.ok) router.push(`/admin/users/${res.id}`);
        else setError(res.message);
      } else {
        const res = await updateUserAction(userId!, {
          email,
          name,
          role,
          active,
          agentLoginId: agentId,
        });
        if (res.ok) router.refresh();
        else setError(res.message);
      }
    });
  };

  return (
    <section style={{ display: "grid", gap: "0.9rem", maxWidth: 460 }}>
      <label className="field">
        <span>Email {mode === "create" ? "*" : ""}</span>
        <input
          className="input"
          type="email"
          aria-label="email"
          value={email}
          disabled={mode === "edit"}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Name *</span>
        <input
          className="input"
          aria-label="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Role *</span>
        <select
          className="select"
          aria-label="role"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      {needsAgent && (
        <label className="field">
          <span>Linked agent *</span>
          <select
            className="select"
            aria-label="agentLoginId"
            value={agentLoginId}
            onChange={(e) => setAgentLoginId(e.target.value)}
          >
            <option value="">— select agent —</option>
            {agents.map((a) => (
              <option key={a.loginId} value={a.loginId}>
                {a.agentName} ({a.loginId})
              </option>
            ))}
          </select>
        </label>
      )}

      {mode === "create" && (
        <label className="field">
          <span>Initial password *</span>
          <input
            className="input"
            type="password"
            aria-label="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      )}

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
          {pending ? "Saving…" : mode === "create" ? "Create user" : "Save changes"}
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
