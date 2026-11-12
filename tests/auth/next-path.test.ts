import { loginUrl, safeNextPath } from "@/lib/auth/next-path";

describe("post-login destination", () => {
  it("keeps a same-site path with its query", () => {
    expect(safeNextPath("/reports?period=2025-11&lens=agent")).toBe(
      "/reports?period=2025-11&lens=agent",
    );
    expect(safeNextPath("/evaluations/abc/correct")).toBe("/evaluations/abc/correct");
  });

  it("falls back to home for anything that could leave the site or loop", () => {
    for (const bad of [
      undefined,
      null,
      "",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "reports",
      "/login",
      "/login?next=/reports",
    ]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });

  it("builds the login URL, carrying the page to come back to", () => {
    expect(loginUrl("/reports?period=2025-11")).toBe("/login?next=%2Freports%3Fperiod%3D2025-11");
    expect(loginUrl("/")).toBe("/login");
    expect(loginUrl("https://evil.example")).toBe("/login");
  });
});
