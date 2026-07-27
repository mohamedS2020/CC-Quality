/**
 * Repository barrel — the project's data-access layer.
 *
 * Import feature-facing DB helpers from here (e.g. `import { agentRepository }
 * from "@/lib/db/repositories"`). Each aggregate gets its own module; more are
 * added as features land (config, evaluation, user, period, ...).
 */
export { agentRepository } from "./agentRepository";
