import { displayMobile, maskMobile } from "@/lib/pii";

describe("maskMobile (FR-19)", () => {
  it("keeps only the last 4 digits, masking the rest", () => {
    expect(maskMobile("01012345678")).toBe("*******5678");
  });

  it("fully masks values of 4 digits or fewer", () => {
    expect(maskMobile("123")).toBe("***");
    expect(maskMobile("9999")).toBe("****");
  });

  it("returns empty for empty or whitespace input", () => {
    expect(maskMobile("")).toBe("");
    expect(maskMobile("   ")).toBe("");
  });
});

describe("displayMobile", () => {
  it("shows the stored masked value", () => {
    expect(displayMobile("*******5678")).toBe("*******5678");
  });

  it("shows an em dash when there is no value", () => {
    expect(displayMobile(null)).toBe("—");
    expect(displayMobile(undefined)).toBe("—");
    expect(displayMobile("")).toBe("—");
  });
});
