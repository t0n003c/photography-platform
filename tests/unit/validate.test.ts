import { describe, it, expect } from "vitest";
import { sniffImage, isAllowedMime } from "@/src/image/validate";

describe("sniffImage", () => {
  it("detects JPEG (ff d8 ff)", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(sniffImage(buf)).toEqual({ mime: "image/jpeg", ext: "jpg" });
  });

  it("detects PNG (89 50 4e 47)", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(sniffImage(buf)).toEqual({ mime: "image/png", ext: "png" });
  });

  it("returns null for random/text bytes", () => {
    expect(sniffImage(Buffer.from("hello world, not an image"))).toBeNull();
  });
});

describe("isAllowedMime", () => {
  it("true for image/jpeg", () => {
    expect(isAllowedMime("image/jpeg")).toBe(true);
  });

  it("false for image/svg+xml", () => {
    expect(isAllowedMime("image/svg+xml")).toBe(false);
  });
});
