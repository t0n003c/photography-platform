import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor, clampLimit } from "@/src/lib/cursor";

describe("encodeCursor / decodeCursor", () => {
  it("roundtrips an object", () => {
    const value = { id: "abc", createdAt: "2026-01-01T00:00:00.000Z", n: 42 };
    expect(decodeCursor(encodeCursor(value))).toEqual(value);
  });

  it("decodeCursor(null) → null", () => {
    expect(decodeCursor(null)).toBeNull();
  });

  it("decodeCursor of non-base64/garbage → null (graceful)", () => {
    expect(decodeCursor("!!!notbase64!!!")).toBeNull();
  });
});

describe("clampLimit", () => {
  it("default when null", () => {
    expect(clampLimit(null)).toBe(50);
  });

  it("clamps above max (200)", () => {
    expect(clampLimit("9999")).toBe(200);
  });

  it("floors invalid input to default", () => {
    expect(clampLimit("not-a-number")).toBe(50);
  });

  it("floors <= 0 to default", () => {
    expect(clampLimit("0")).toBe(50);
    expect(clampLimit("-5")).toBe(50);
  });
});
