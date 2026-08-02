import type { ScoreSheetRubric } from "@/app/evaluations/new/types";
import type { LoadedConfig } from "@/lib/config/loader";

/** Flatten a loaded config into the serializable rubric the score sheet renders. */
export function rubricFromConfig(config: LoadedConfig): ScoreSheetRubric {
  return {
    sections: config.sections.map((s) => ({
      id: s.id,
      code: s.code,
      label: s.label,
      categories: s.categories.map((c) => ({
        id: c.id,
        label: c.label,
        attributes: c.attributes.map((a) => ({
          id: a.id,
          label: a.label,
          errorReasons: a.errorReasons.map((r) => ({ id: r.id, label: r.label })),
        })),
      })),
    })),
  };
}
