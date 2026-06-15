import { describe, it, expect } from "vitest";
import {
  hashToken,
  generateShareToken,
  constantTimeEqualHex,
  isGrantActive,
  type Grant,
} from "@/src/auth/grant";

describe("hashToken", () => {
  it("is deterministic: same input → same 64-char hex", () => {
    const a = hashToken("hello-token");
    const b = hashToken("hello-token");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different input", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});

describe("generateShareToken", () => {
  it("returns { raw, hash } where hash === hashToken(raw)", () => {
    const { raw, hash } = generateShareToken();
    expect(hash).toBe(hashToken(raw));
  });

  it("raw is URL-safe and >= 32 chars", () => {
    const { raw } = generateShareToken();
    expect(raw.length).toBeGreaterThanOrEqual(32);
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("constantTimeEqualHex", () => {
  it("true for equal hex", () => {
    const h = hashToken("x");
    expect(constantTimeEqualHex(h, h)).toBe(true);
  });

  it("false for different hex of equal length", () => {
    expect(constantTimeEqualHex(hashToken("x"), hashToken("y"))).toBe(false);
  });

  it("false for length mismatch", () => {
    expect(constantTimeEqualHex("aabb", "aa")).toBe(false);
  });
});

describe("isGrantActive", () => {
  it("active when revokedAt null + expiresAt null", () => {
    const g = { revokedAt: null, expiresAt: null } as any as Grant;
    expect(isGrantActive(g)).toBe(true);
  });

  it("inactive when revokedAt set", () => {
    const g = { revokedAt: new Date(), expiresAt: null } as any as Grant;
    expect(isGrantActive(g)).toBe(false);
  });

  it("inactive when expiresAt is in the past", () => {
    const g = {
      revokedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    } as any as Grant;
    expect(isGrantActive(g)).toBe(false);
  });

  it("active when expiresAt is in the future", () => {
    const g = {
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    } as any as Grant;
    expect(isGrantActive(g)).toBe(true);
  });
});
