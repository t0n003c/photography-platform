import { describe, it, expect } from "vitest";
import { newId } from "@/src/lib/id";

const CHARSET = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

describe("newId", () => {
  it("returns a 26-char Crockford-base32 string", () => {
    const id = newId();
    expect(id).toHaveLength(26);
    expect(id).toMatch(CHARSET);
  });

  it("generates 1000 unique ids, all valid charset and length", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = newId();
      expect(id).toMatch(CHARSET);
      ids.add(id);
    }
    expect(ids.size).toBe(1000);
  });

  it("is non-decreasing-ish over time (timestamp prefix sorts)", () => {
    const a = newId();
    const b = newId();
    expect(b >= a || b < a).toBe(true); // both are valid strings
    // The time component (first 10 chars) of the later id is >= the earlier.
    expect(b.slice(0, 10) >= a.slice(0, 10)).toBe(true);
  });
});
