import { describe, expect, it } from "vitest";
import { decodePreview, encodePreview } from "@/src/lib/preview";

describe("gallery preview config", () => {
  it("round-trips the casual image-saving deterrent flag", () => {
    const encoded = encodePreview({
      gridType: "justified",
      discourageImageSaving: true,
    });

    expect(decodePreview(encoded)).toMatchObject({
      gridType: "justified",
      discourageImageSaving: true,
    });
  });
});
