import { describe, it, expect } from "vitest";
import {
  issueGallerySession,
  verifyGallerySession,
} from "@/src/auth/gallery-session";

describe("gallery session", () => {
  it("issues then verifies for the same grantId", () => {
    const grantId = "grant-123";
    const value = issueGallerySession(grantId);
    expect(verifyGallerySession(value, grantId)).toBe(true);
  });

  it("rejects a wrong grantId", () => {
    const value = issueGallerySession("grant-123");
    expect(verifyGallerySession(value, "grant-999")).toBe(false);
  });

  it("rejects a tampered value", () => {
    const value = issueGallerySession("grant-123");
    const chars = value.split("");
    // Flip the last character (part of the signature).
    const last = chars[chars.length - 1];
    chars[chars.length - 1] = last === "A" ? "B" : "A";
    expect(verifyGallerySession(chars.join(""), "grant-123")).toBe(false);
  });

  it("rejects undefined value", () => {
    expect(verifyGallerySession(undefined, "grant-123")).toBe(false);
  });
});
