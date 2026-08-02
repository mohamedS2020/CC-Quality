/**
 * @jest-environment node
 *
 * FR-19 "never in URLs" guard: a mobile (raw or masked) must never appear in a
 * path, query string, or redirect. This scans the app/lib source for the
 * patterns that would put it there and fails if any are found.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(process.cwd(), "src");

function collect(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: "mobile as a URL query param", pattern: /[?&]mobile=/i },
  {
    name: "searchParams set/append of mobile",
    pattern: /searchParams\.(set|append)\(\s*[`'"]mobile/i,
  },
];

const files = collect(SRC).map((f) => relative(process.cwd(), f));

describe("mobile is never put in a URL (FR-19)", () => {
  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s has no mobile-in-URL pattern", (file) => {
    const code = readFileSync(join(process.cwd(), file), "utf8");
    const violations = FORBIDDEN.flatMap(({ name, pattern }) => (pattern.test(code) ? [name] : []));
    expect(violations).toEqual([]);
  });
});
