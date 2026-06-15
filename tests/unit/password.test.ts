import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/src/lib/password";

describe("password hashing", () => {
  it("roundtrips: hashPassword then verifyPassword is true", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(
      true,
    );
  });

  it("returns false for the wrong password", async () => {
    const stored = await hashPassword("right");
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });

  it("returns false for a malformed stored hash", async () => {
    expect(await verifyPassword("anything", "not-a-valid-hash")).toBe(false);
  });
});
