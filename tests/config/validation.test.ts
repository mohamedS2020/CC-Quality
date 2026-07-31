/**
 * @jest-environment node
 *
 * Config guardrails (FR-29): every guardrail rejects bad input, and the save
 * path (createConfigVersion) blocks persistence on any violation.
 */
import { prisma } from "@/lib/db/client";
import type { ConfigInput } from "@/lib/config/input";
import { ConfigValidationError, validateConfigInput } from "@/lib/config/validation";
import { createConfigVersion } from "@/lib/config/versioning";

const createdIds: number[] = [];

function validInput(): ConfigInput {
  return {
    name: "Valid",
    severities: ["Business Critical"],
    trainingBuckets: ["Telephone etiquette"],
    sections: [
      {
        code: "CC",
        label: "Call Control",
        scoringMode: "SECTION_BINARY",
        critical: true,
        capPerAttribute: false,
        rankWeight: 60,
        rankBenchmark: 0.99,
        categories: [
          {
            label: "Cat",
            attributes: [
              {
                label: "Attr1",
                errorReasons: [
                  {
                    label: "Reason1",
                    dictionary: {
                      definition: null,
                      severityLabel: "Business Critical",
                      trainingBucketLabel: "Telephone etiquette",
                      thresholds: [],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        code: "NC",
        label: "Non Critical",
        scoringMode: "GRADED_ATTRIBUTES",
        critical: false,
        capPerAttribute: false,
        rankWeight: 40,
        rankBenchmark: 0.95,
        categories: [
          {
            label: "CatN",
            attributes: [
              { label: "A1", errorReasons: [] },
              { label: "A2", errorReasons: [] },
            ],
          },
        ],
      },
    ],
    lenses: [
      {
        key: "account",
        label: "Account",
        basis: "PER_ERROR",
        benchmarks: [
          { sectionCode: "CC", threshold: 0.995 },
          { sectionCode: "NC", threshold: 0.95 },
        ],
      },
    ],
  };
}

function hasError(input: ConfigInput, needle: string): boolean {
  const result = validateConfigInput(input);
  return result.ok
    ? false
    : result.errors.some((e) => e.message.includes(needle) || e.path.includes(needle));
}

afterAll(async () => {
  if (createdIds.length) {
    await prisma.scorecardConfig.deleteMany({ where: { id: { in: createdIds } } });
  }
  await prisma.$disconnect();
});

describe("config guardrails (FR-29)", () => {
  it("passes a valid config", () => {
    expect(validateConfigInput(validInput())).toEqual({ ok: true });
  });

  it("rejects rank weights that do not sum to 100", () => {
    const input = validInput();
    input.sections[0].rankWeight = 50;
    expect(hasError(input, "sum to 100")).toBe(true);
  });

  it("rejects a benchmark outside [0,1]", () => {
    const input = validInput();
    input.lenses[0].benchmarks[0].threshold = 1.5;
    expect(hasError(input, "between 0 and 1")).toBe(true);
  });

  it("rejects a rank benchmark outside [0,1]", () => {
    const input = validInput();
    input.sections[0].rankBenchmark = 2;
    expect(hasError(input, "Rank benchmark")).toBe(true);
  });

  it("rejects duplicate attribute names within a section", () => {
    const input = validInput();
    input.sections[1].categories[0].attributes[1].label = "A1";
    expect(hasError(input, "Duplicate attribute name")).toBe(true);
  });

  it("rejects a graded section with no attributes", () => {
    const input = validInput();
    input.sections[1].categories[0].attributes = [];
    expect(hasError(input, "at least one attribute")).toBe(true);
  });

  it("rejects a lens missing a benchmark for a section", () => {
    const input = validInput();
    input.lenses[0].benchmarks = [{ sectionCode: "CC", threshold: 0.995 }];
    expect(hasError(input, "Missing benchmark")).toBe(true);
  });

  it("rejects a dictionary reference to an unknown severity", () => {
    const input = validInput();
    input.sections[0].categories[0].attributes[0].errorReasons[0].dictionary!.severityLabel =
      "Nope";
    expect(hasError(input, "Unknown severity")).toBe(true);
  });

  it("rejects duplicate section codes", () => {
    const input = validInput();
    input.sections[1].code = "CC";
    expect(hasError(input, "Duplicate section code")).toBe(true);
  });

  it("rejects duplicate lens keys", () => {
    const input = validInput();
    input.lenses = [input.lenses[0], { ...input.lenses[0] }];
    expect(hasError(input, "Duplicate lens key")).toBe(true);
  });

  it("blocks the save (createConfigVersion throws) on an invalid config", async () => {
    const input = validInput();
    input.sections[0].rankWeight = 999;
    await expect(createConfigVersion(input)).rejects.toBeInstanceOf(ConfigValidationError);
  });

  it("persists a valid config", async () => {
    const created = await createConfigVersion(validInput());
    createdIds.push(created.id);
    expect(created.version).toBeGreaterThan(0);
  });
});
