import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { extractColorPalette } from "@/src/image/colors";

describe("photo color palette extraction", () => {
  it("keeps multiple substantial colors from a photo sample", async () => {
    const input = await sharp({
      create: {
        width: 20,
        height: 20,
        channels: 3,
        background: { r: 240, g: 30, b: 60 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 10,
              height: 20,
              channels: 3,
              background: { r: 20, g: 100, b: 220 },
            },
          })
            .png()
            .toBuffer(),
          left: 10,
          top: 0,
        },
      ])
      .png()
      .toBuffer();

    const palette = await extractColorPalette(input);

    expect(palette.length).toBeGreaterThanOrEqual(2);
    expect(palette.length).toBeLessThanOrEqual(5);
    expect(palette).toEqual(expect.arrayContaining(["#f01e3c", "#1464dc"]));
  });
});
