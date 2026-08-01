import type { ScoringMode } from "@prisma/client";
import type { ScoringPlugin } from "../types";
import { sectionBinaryPlugin } from "./sectionBinary";
import { gradedAttributesPlugin } from "./gradedAttributes";

/**
 * The scoring-mode plugin registry (§4.1 / Appendix H). Adding a mode is a new
 * plugin here — the engine dispatches on `section.scoringMode`, never on a code.
 */
const registry = new Map<ScoringMode, ScoringPlugin>([
  [sectionBinaryPlugin.mode, sectionBinaryPlugin],
  [gradedAttributesPlugin.mode, gradedAttributesPlugin],
]);

export function getScoringPlugin(mode: ScoringMode): ScoringPlugin {
  const plugin = registry.get(mode);
  if (!plugin) throw new Error(`No scoring plugin registered for mode "${mode}".`);
  return plugin;
}
