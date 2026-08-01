/**
 * @jest-environment node
 *
 * The Appendix H golden-rule guard. `lib/engine/**` must contain only mechanics
 * — iterate sections, apply each scoring mode, compare to its benchmark, roll
 * up. A hardcoded section code, benchmark, rank weight, or the NC denominator in
 * engine logic is a bug; this test greps for them (comments stripped first).
 *
 * Allowed: structural literals (0/1/2), calendar constants (3/4/7), and enum
 * references like `ScoringMode.SECTION_BINARY` (a plugin key, not a domain value).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ENGINE_DIR = join(process.cwd(), "src", "lib", "engine");

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectTsFiles(full));
    else if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: "quoted section code (CC/EUC/BC/NC)", pattern: /['"`](CC|EUC|BC|NC)['"`]/ },
  { name: "decimal literal (benchmark/threshold)", pattern: /\b\d+\.\d+\b/ },
  {
    name: "domain integer (NC denominator 6 / rank weights 10·25·30·35)",
    pattern: /\b(6|10|25|30|35)\b/,
  },
];

const files = collectTsFiles(ENGINE_DIR).map((f) => relative(process.cwd(), f));

describe("engine hardcode guard (Appendix H golden rule)", () => {
  it("finds engine source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s contains no hardcoded domain values", (file) => {
    const code = stripComments(readFileSync(join(process.cwd(), file), "utf8"));
    const violations = FORBIDDEN.flatMap(({ name, pattern }) => {
      const match = code.match(pattern);
      return match ? [`${name}: "${match[0]}"`] : [];
    });
    expect(violations).toEqual([]);
  });
});
