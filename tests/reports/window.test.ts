/**
 * Report time-window resolution: the free From/To range that the reports page,
 * the drill-down and the export route all share, so one URL always means one
 * report. Pure — no DB.
 */
import { parseFilterDate, resolveWindow } from "@/lib/reports/resolve";
import { sliceWhere } from "@/lib/reports/metrics";

const PERIOD = { periodId: 7, previousPeriodId: 6, label: "2026-06" };
const iso = (d: Date) => d.toISOString();

describe("parseFilterDate", () => {
  it("reads YYYY-MM-DD as UTC midnight", () => {
    expect(iso(parseFilterDate("2026-06-01")!)).toBe("2026-06-01T00:00:00.000Z");
  });

  it("rejects junk, partial and rolled-over dates", () => {
    for (const bad of ["", undefined, null, "2026-6-1", "01/06/2026", "2026-02-31", "2026-13-01"]) {
      expect(parseFilterDate(bad)).toBeNull();
    }
  });
});

describe("resolveWindow", () => {
  it("falls back to the period when no range is given", () => {
    const { window, invalid } = resolveWindow({}, PERIOD);
    expect(invalid).toBeNull();
    expect(window.current).toEqual({ kind: "period", periodId: 7 });
    expect(window.previous).toEqual({ kind: "period", periodId: 6 });
    expect(window.label).toBe("2026-06");
    expect([window.from, window.to]).toEqual([null, null]);
  });

  it("carries no previous slice when the period is the earliest one", () => {
    const { window } = resolveWindow({}, { ...PERIOD, previousPeriodId: null });
    expect(window.previous).toBeNull();
  });

  it("a valid range wins over the period, with a half-open upper bound", () => {
    const { window, invalid } = resolveWindow({ from: "2026-06-01", to: "2026-06-14" }, PERIOD);
    expect(invalid).toBeNull();
    expect(window.current.kind).toBe("range");
    if (window.current.kind !== "range") throw new Error("expected a range");
    expect(iso(window.current.from)).toBe("2026-06-01T00:00:00.000Z");
    // Exclusive end = midnight of the day AFTER `to`, so 06-14 counts in full.
    expect(iso(window.current.toExclusive)).toBe("2026-06-15T00:00:00.000Z");
    expect(window.period).toBeNull();
    expect(window.label).toBe("2026-06-01 → 2026-06-14");
  });

  it("compares against the equally-long stretch immediately before", () => {
    const { window } = resolveWindow({ from: "2026-06-01", to: "2026-06-14" }, PERIOD);
    if (window.previous?.kind !== "range") throw new Error("expected a previous range");
    // 14 days ending 06-14 → the 14 days ending 05-31.
    expect(iso(window.previous.from)).toBe("2026-05-18T00:00:00.000Z");
    expect(iso(window.previous.toExclusive)).toBe("2026-06-01T00:00:00.000Z");
  });

  it("labels a single-day range with just that day", () => {
    const { window } = resolveWindow({ from: "2026-06-03", to: "2026-06-03" }, PERIOD);
    expect(window.label).toBe("2026-06-03");
    if (window.current.kind !== "range") throw new Error("expected a range");
    expect(iso(window.current.toExclusive)).toBe("2026-06-04T00:00:00.000Z");
  });

  it("falls back to the period (never a wider query) on unusable input", () => {
    const cases = [
      { from: "2026-06-01" }, // missing half
      { to: "2026-06-14" },
      { from: "nope", to: "2026-06-14" },
      { from: "2026-06-14", to: "2026-06-01" }, // reversed
    ];
    for (const params of cases) {
      const { window, invalid } = resolveWindow(params, PERIOD);
      expect(invalid).toBeTruthy();
      expect(window.current).toEqual({ kind: "period", periodId: 7 });
    }
  });
});

describe("sliceWhere", () => {
  it("filters by period id for a preset month", () => {
    expect(sliceWhere({ kind: "period", periodId: 7 })).toEqual({ periodId: 7 });
  });

  it("filters callDate with an inclusive start and exclusive end", () => {
    const from = new Date("2026-06-01T00:00:00Z");
    const toExclusive = new Date("2026-06-15T00:00:00Z");
    expect(sliceWhere({ kind: "range", from, toExclusive })).toEqual({
      callDate: { gte: from, lt: toExclusive },
    });
  });
});
