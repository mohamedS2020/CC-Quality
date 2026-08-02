import type { LoadedConfig } from "@/lib/config/loader";

/**
 * Agent tenure standing (FR-13). `status` (old/new) and `in_trial` are DERIVED
 * from join_date against the CONFIGURED thresholds — never stored, never
 * hardcoded (golden rule). Both boundaries come from the config version, so an
 * admin can change the policy in the editor without a code change.
 */

export type AgentTenureStatus = "new" | "old";

export interface AgentStanding {
  tenureDays: number;
  status: AgentTenureStatus;
  inTrial: boolean;
}

/** Whole days between joinDate and asOf, floored and never negative. */
export function tenureDays(joinDate: Date, asOf: Date): number {
  const ms = asOf.getTime() - joinDate.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * Derive standing from join_date vs the config thresholds. `asOf` defaults to
 * now (the natural reference for an agent roster); reporting can pass a period
 * start when it needs status "as of" that period.
 */
export function deriveAgentStanding(
  joinDate: Date,
  config: Pick<LoadedConfig, "newAgentTenureDays" | "trialWindowDays">,
  asOf: Date = new Date(),
): AgentStanding {
  const days = tenureDays(joinDate, asOf);
  return {
    tenureDays: days,
    status: days < config.newAgentTenureDays ? "new" : "old",
    inTrial: days < config.trialWindowDays,
  };
}
