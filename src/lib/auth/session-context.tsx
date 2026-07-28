"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { PublicUser } from "./context";
import type { PermissionKey } from "./permissions";

/** The subset of the user surfaced to client components (no timestamps). */
export type SessionUser = Pick<
  PublicUser,
  "id" | "email" | "name" | "role" | "active" | "agentLoginId"
>;

export type SessionValue = {
  user: SessionUser | null;
  /**
   * The caller's effective permission keys, resolved server-side (Admin = all,
   * Agent = fixed self-scope set, Moderator = granted). Empty when signed out.
   */
  permissions: PermissionKey[];
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ value, children }: { value: SessionValue; children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** The current session (user + effective permissions). Requires a SessionProvider. */
export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (ctx === null) {
    throw new Error("useSession must be used within a <SessionProvider>.");
  }
  return ctx;
}

/**
 * A permission checker for conditionally rendering or disabling controls.
 *
 * CONVENIENCE ONLY: the authoritative check is the server-side `authorize`
 * guard (task 3.4). Hiding a button is a nicety — never a substitute for
 * enforcing access on the server.
 */
export function useCan(): (permission: PermissionKey) => boolean {
  const { permissions } = useSession();
  return useMemo(() => {
    const granted = new Set(permissions);
    return (permission: PermissionKey) => granted.has(permission);
  }, [permissions]);
}
