import type { LoadedConfig } from "@/lib/config/loader";

/**
 * Agent Rank (§5.6): add each section's rank weight when the agent's section
 * accuracy meets that section's rank benchmark (`≥`, §5.8). Weights sum to 100
 * (validated), so rank is a 0–100 score. A section with n/a accuracy (NaN) does
 * not meet the benchmark and contributes 0.
 *
 * `agentAccuracy` is the §5.3 agent × section accuracy (sectionId → value).
 */
export function computeAgentRank(config: LoadedConfig, agentAccuracy: Map<number, number>): number {
  let score = 0;
  for (const section of config.sections) {
    const accuracy = agentAccuracy.get(section.id);
    if (accuracy !== undefined && accuracy >= section.rankBenchmark) {
      score += section.rankWeight;
    }
  }
  return score;
}
