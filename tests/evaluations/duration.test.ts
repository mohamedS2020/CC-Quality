import {
  durationIsValid,
  formatDuration,
  normalizeDuration,
  parseDuration,
} from "@/lib/evaluations/duration";

describe("call duration (mm:ss)", () => {
  it("reads minutes:seconds, hh:mm:ss and bare minutes", () => {
    expect(parseDuration("03:30")).toBe(210);
    expect(parseDuration("3:5")).toBe(185);
    expect(parseDuration("75:10")).toBe(4510);
    expect(parseDuration("00:07:26\t")).toBe(446); // pasted from the source sheet
    expect(parseDuration("1:02:03")).toBe(3723);
    expect(parseDuration("4")).toBe(240);
    expect(parseDuration(" 03 : 30 ")).toBe(210);
  });

  it("treats blank as not provided and rejects unreadable text", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("   ")).toBeNull();
    expect(parseDuration("3:75")).toBeNaN();
    expect(parseDuration("1:60:00")).toBeNaN();
    expect(parseDuration("abc")).toBeNaN();
    expect(durationIsValid("")).toBe(true);
    expect(durationIsValid("3:75")).toBe(false);
  });

  it("formats seconds as mm:ss and normalises input", () => {
    expect(formatDuration(210)).toBe("03:30");
    expect(formatDuration(4510)).toBe("75:10");
    expect(formatDuration(0)).toBe("00:00");
    expect(normalizeDuration("00:07:26")).toBe("07:26");
    expect(normalizeDuration("3:5")).toBe("03:05");
    expect(normalizeDuration("abc")).toBe("abc");
    expect(normalizeDuration("")).toBe("");
  });
});
