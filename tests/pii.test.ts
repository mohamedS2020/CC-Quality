import { displayMobile, maskMobile, phoneSearchDigits } from "@/lib/pii";

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

describe("phoneSearchDigits", () => {
  it("reduces a full number to its last 4 digits (matches the masked suffix)", () => {
    expect(phoneSearchDigits("01007005658")).toBe("5658");
    expect(maskMobile("01007005658").endsWith(phoneSearchDigits("01007005658"))).toBe(true);
  });

  it("accepts the last 4 directly and ignores non-digits", () => {
    expect(phoneSearchDigits("5658")).toBe("5658");
    expect(phoneSearchDigits(" 56-58 ")).toBe("5658");
  });

  it("is empty when there are no digits", () => {
    expect(phoneSearchDigits("")).toBe("");
    expect(phoneSearchDigits("abc")).toBe("");
  });
});
