/**
 * @jest-environment node
 *
 * Bulk importer (task 6.4, FR-17): parse the source CSV, resolve agents/reasons
 * against the config, run the shared engine derivation, and dedupe by eval_id.
 * Uses a self-created inactive config so it never touches the active pointer.
 */
import { prisma } from "@/lib/db/client";
import { baselineConfigInput } from "@/lib/config/baseline";
import { createConfigVersion } from "@/lib/config/versioning";
import { loadConfigById, type LoadedConfig } from "@/lib/config/loader";
import { buildAgentResolver, type AgentResolver } from "@/lib/agents/normalize";
import { importEvaluations, parseCsv, parseXlsx, validateImport } from "@/lib/evaluations/import";
import ExcelJS from "exceljs";

const AGENT_ID = 850001;
const ARABIC_ALIAS = "مستورد";
let config: LoadedConfig;
let configId: number;
let resolver: AgentResolver;

// Real baseline labels (CC → Confidentiality/Security verification).
const HEADER = "eval_id,login_id,agent_name,qa_owner,call_date,section_code,attribute,error_reason";
const CC_ERROR_ROW =
  "IMP-E1,850001,,qa,2025-07-01,CC,Security verification,Didn't make security verification";
const CLEAN_ROW = "IMP-E2,850001,,qa,2025-07-02,,,";

async function clearEvaluations() {
  await prisma.evaluation.deleteMany({ where: { agentLoginId: AGENT_ID } });
}

beforeAll(async () => {
  const created = await createConfigVersion(baselineConfigInput);
  configId = created.id;
  const loaded = await loadConfigById(created.id);
  if (!loaded) throw new Error("config load failed");
  config = loaded;

  await clearEvaluations();
  await prisma.agent.deleteMany({ where: { loginId: AGENT_ID } });
  await prisma.agent.create({
    data: {
      loginId: AGENT_ID,
      agentName: "Import Agent",
      tlName: "TL",
      joinDate: new Date("2025-01-01"),
      aliases: { create: [{ alias: ARABIC_ALIAS }] },
    },
  });
  resolver = await buildAgentResolver();
});

afterEach(clearEvaluations);

afterAll(async () => {
  await clearEvaluations();
  await prisma.agent.deleteMany({ where: { loginId: AGENT_ID } });
  await prisma.scorecardConfig.deleteMany({ where: { id: configId } });
  await prisma.$disconnect();
});

describe("parseCsv", () => {
  it("parses headers, rows, and quoted fields containing commas", () => {
    const rows = parseCsv('a,b\n1,2\n"x,y",3');
    expect(rows).toEqual([
      { a: "1", b: "2" },
      { a: "x,y", b: "3" },
    ]);
  });
});

describe("importEvaluations (FR-17)", () => {
  it("imports rows with the shared derivation, grouping errors by eval_id", async () => {
    const result = await importEvaluations(
      config,
      parseCsv(`${HEADER}\n${CC_ERROR_ROW}\n${CLEAN_ROW}`),
      resolver,
    );
    expect(result).toEqual({ imported: 2, skipped: 0, errors: [] });

    const e1 = await prisma.evaluation.findUniqueOrThrow({
      where: { evalId: "IMP-E1" },
      include: { lines: true },
    });
    expect(e1.sumOfCriticals).toBe(1);
    expect(e1.failedScorecard).toBe(true);
    expect(e1.lines).toHaveLength(1);

    const e2 = await prisma.evaluation.findUniqueOrThrow({ where: { evalId: "IMP-E2" } });
    expect(e2.failedScorecard).toBe(false);
  });

  it("is idempotent — re-importing the same eval_ids skips them", async () => {
    const csv = `${HEADER}\n${CC_ERROR_ROW}\n${CLEAN_ROW}`;
    await importEvaluations(config, parseCsv(csv), resolver);
    const second = await importEvaluations(config, parseCsv(csv), resolver);
    expect(second).toEqual({ imported: 0, skipped: 2, errors: [] });
  });

  it("reports orphan reasons and unresolvable agents without importing them", async () => {
    const csv = [
      HEADER,
      "IMP-E3,850001,,qa,2025-07-03,CC,Security verification,Not a real reason",
      "IMP-E4,,Ghost Person,qa,2025-07-04,,,",
    ].join("\n");
    const result = await importEvaluations(config, parseCsv(csv), resolver);
    expect(result.imported).toBe(0);
    expect(result.errors.map((e) => e.evalId).sort()).toEqual(["IMP-E3", "IMP-E4"]);
  });

  it("resolves an agent by Arabic alias when no login_id is given", async () => {
    const csv = `${HEADER}\nIMP-E5,,${ARABIC_ALIAS},qa,2025-07-05,,,`;
    const result = await importEvaluations(config, parseCsv(csv), resolver);
    expect(result.imported).toBe(1);
    const e5 = await prisma.evaluation.findUniqueOrThrow({ where: { evalId: "IMP-E5" } });
    expect(e5.agentLoginId).toBe(AGENT_ID);
  });
});

describe("parseXlsx (FR-17)", () => {
  it("reads an .xlsx into the same row shape and feeds the same import pipeline", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("data");
    sheet.addRow(HEADER.split(","));
    sheet.addRow([
      "IMP-X1",
      "850001",
      "",
      "qa",
      "2025-07-01",
      "CC",
      "Security verification",
      "Didn't make security verification",
    ]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const rows = await parseXlsx(buffer);
    expect(rows).toHaveLength(1);
    expect(rows[0].eval_id).toBe("IMP-X1");

    const result = await importEvaluations(config, rows, resolver);
    expect(result.imported).toBe(1);
    const saved = await prisma.evaluation.findUniqueOrThrow({
      where: { evalId: "IMP-X1" },
      include: { lines: true },
    });
    expect(saved.lines).toHaveLength(1);
  });
});

describe("validateImport (FR-18 dry-run)", () => {
  it("reports ready and errors without writing anything", async () => {
    const csv = [
      HEADER,
      CC_ERROR_ROW,
      "IMP-E3,850001,,qa,2025-07-03,CC,Security verification,Not a real reason",
      "IMP-E4,,Ghost Person,qa,2025-07-04,,,",
    ].join("\n");
    const validation = await validateImport(config, parseCsv(csv), resolver);
    expect(validation.ready).toBe(1);
    expect(validation.errors.map((e) => e.evalId).sort()).toEqual(["IMP-E3", "IMP-E4"]);
    // Dry-run persists nothing.
    expect(await prisma.evaluation.findUnique({ where: { evalId: "IMP-E1" } })).toBeNull();
  });

  it("counts an already-imported eval_id as a duplicate", async () => {
    await importEvaluations(config, parseCsv(`${HEADER}\n${CC_ERROR_ROW}`), resolver);
    const validation = await validateImport(
      config,
      parseCsv(`${HEADER}\n${CC_ERROR_ROW}`),
      resolver,
    );
    expect(validation).toEqual({ ready: 0, duplicate: 1, errors: [] });
  });
});
