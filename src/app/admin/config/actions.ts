"use server";

import { authorize } from "@/lib/auth";
import { AuthError } from "@/lib/auth/errors";
import type { ConfigInput } from "@/lib/config/input";
import { createConfigVersion } from "@/lib/config/versioning";
import { ConfigValidationError, type ValidationError } from "@/lib/config/validation";

export type SaveConfigResult =
  { ok: true; version: number } | { ok: false; errors?: ValidationError[]; message?: string };

/**
 * Save the editor's draft as a new active config version (FR-30). Guarded by
 * `config.edit` and validated server-side (FR-29) — the client preview never
 * substitutes for this check.
 */
export async function saveConfigAction(draft: ConfigInput): Promise<SaveConfigResult> {
  let ctx;
  try {
    ctx = await authorize("config.edit");
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        message:
          error.status === 401
            ? "You are not signed in."
            : "You do not have permission to edit configuration.",
      };
    }
    throw error;
  }

  try {
    const { version } = await createConfigVersion(draft, {
      activate: true,
      createdById: ctx.user.id,
    });
    return { ok: true, version };
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      return { ok: false, errors: error.errors };
    }
    throw error;
  }
}
