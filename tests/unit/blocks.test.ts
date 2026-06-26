import { describe, expect, it } from "vitest";
import { parseBlocks } from "@/src/lib/blocks";
import { presetBlocks } from "@/src/lib/page-presets";

describe("page builder blocks", () => {
  it("keeps and defaults contact form blocks", () => {
    const blocks = parseBlocks([
      {
        id: "contact",
        type: "contactForm",
        style: "split",
        heading: "Start here",
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "contact",
      type: "contactForm",
      style: "split",
      heading: "Start here",
      eyebrow: "Contact",
      submitLabel: "Send message",
      align: "left",
    });
  });

  it("creates a contact form in contact page presets", () => {
    const blocks = presetBlocks("contact", () => "id");

    expect(blocks.some((block) => block.type === "contactForm")).toBe(true);
  });
});
