/**
 * Read-only config viewer (FR-28): renders a LoadedConfig — policy, sections,
 * rubric with dictionary tags, and lenses with a provisional badge — without any
 * editing affordance. Pure presentational server component; rendered directly.
 */
import { render, screen } from "@testing-library/react";
import { LensBasis, ScoringMode } from "@prisma/client";
import { ConfigViewer } from "@/app/admin/config/config-viewer";
import type { LoadedConfig, LoadedSection } from "@/lib/config/loader";

const errorReason = {
  id: 1000,
  label: "Skipped verification",
  orderIndex: 0,
  attributeId: 100,
  sectionId: 1,
  dictionary: {
    id: 1,
    errorReasonId: 1000,
    definition: null,
    severity: "Business Critical",
    trainingBucket: "Telephone etiquette",
    thresholds: [],
  },
};
const attribute = {
  id: 100,
  label: "Verification",
  orderIndex: 0,
  categoryId: 10,
  sectionId: 1,
  errorReasons: [errorReason],
};
const section: LoadedSection = {
  id: 1,
  code: "CC",
  label: "Call Compliance",
  orderIndex: 0,
  scoringMode: ScoringMode.SECTION_BINARY,
  critical: true,
  capPerAttribute: false,
  rankWeight: 2,
  rankBenchmark: 0.95,
  categories: [
    { id: 10, label: "Compliance", orderIndex: 0, sectionId: 1, attributes: [attribute] },
  ],
  attributes: [attribute],
  attributeCount: 1,
};

const provisionalBasis = Object.values(LensBasis).find(
  (b) => b !== LensBasis.PER_ERROR,
) as LensBasis;

const config: LoadedConfig = {
  id: 1,
  version: 3,
  name: "CC MarQ Quality Scorecard",
  isActive: true,
  roundingDecimals: 2,
  paretoCutoff: 0.8,
  newAgentTenureDays: 90,
  trialWindowDays: 90,
  sections: [section],
  lenses: [
    {
      id: 1,
      key: "per_error",
      label: "Per error",
      basis: LensBasis.PER_ERROR,
      orderIndex: 0,
      benchmarks: new Map([[1, 0.95]]),
    },
    {
      id: 2,
      key: "prov",
      label: "Provisional lens",
      basis: provisionalBasis,
      orderIndex: 1,
      benchmarks: new Map(),
    },
  ],
  severities: ["Soft Skills", "Business Critical"],
  trainingBuckets: ["Telephone etiquette"],
  sectionById: new Map([[1, section]]),
  errorReasonById: new Map(),
  lensByKey: new Map(),
};

describe("ConfigViewer", () => {
  it("renders the config, sections, rubric, benchmarks, and policy read-only", () => {
    const { container } = render(<ConfigViewer config={config} />);
    const text = container.textContent ?? "";

    expect(text).toContain("CC MarQ Quality Scorecard");
    expect(text).toContain("Version 3");
    expect(text).toContain("Active");
    // Section + humanized scoring mode + rubric leaf with its dictionary tags.
    expect(text).toContain("Call Compliance");
    expect(text).toContain("Section binary");
    expect(text).toContain("critical");
    expect(text).toContain("Skipped verification");
    expect(text).toContain("Business Critical · Telephone etiquette");
    // Policy scalars (FR-13 thresholds + Pareto).
    expect(text).toContain("90 days");
    expect(text).toContain("80%");
    // Lens benchmark resolved to its section code.
    expect(text).toContain("≥ 95%");

    // Only the non-verified lens is badged provisional; there is no editor here.
    expect(screen.getAllByText("provisional")).toHaveLength(1);
    expect(screen.queryByText(/Save as new version/i)).not.toBeInTheDocument();
  });
});
