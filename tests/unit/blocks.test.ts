import { describe, expect, it } from "vitest";
import { collectPhotoIds, parseBlocks } from "@/src/lib/blocks";
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

  it("keeps testimonial blocks and collects portrait photos", () => {
    const blocks = parseBlocks([
      {
        id: "reviews",
        type: "testimonials",
        items: [
          {
            id: "review-1",
            name: "Ashley",
            affiliation: "Client",
            quote: "Wonderful work.",
            photoId: "photo-1",
          },
        ],
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "reviews",
      type: "testimonials",
      label: "Reviews",
      autoplay: false,
      showThumbnails: true,
    });
    expect(collectPhotoIds(blocks)).toEqual(["photo-1"]);
  });

  it("keeps team blocks and collects member portraits", () => {
    const blocks = parseBlocks([
      {
        id: "team",
        type: "team",
        members: [
          {
            id: "member-1",
            name: "Mak VieSAinte",
            role: "Founder",
            photoId: "photo-team-1",
          },
        ],
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "team",
      type: "team",
      title: "",
      layout: "showcase",
      cardPosition: "alternate",
      showCardArrow: true,
      grayscale: true,
      showSocials: true,
      members: [
        expect.objectContaining({
          description:
            "Share a short bio, specialty, or role description for this team member.",
        }),
      ],
    });
    expect(collectPhotoIds(blocks)).toEqual(["photo-team-1"]);
  });

  it("keeps editorial team member card settings", () => {
    const blocks = parseBlocks([
      {
        id: "team",
        type: "team",
        layout: "memberCards",
        cardPosition: "right",
        showCardArrow: false,
        members: [
          {
            id: "member-1",
            name: "Jennie Garcia",
            role: "Backend Engineer",
            description: "Builds polished client experiences.",
          },
        ],
      },
    ]);

    expect(blocks[0]).toMatchObject({
      id: "team",
      type: "team",
      layout: "memberCards",
      cardPosition: "right",
      showCardArrow: false,
      members: [
        expect.objectContaining({
          name: "Jennie Garcia",
          description: "Builds polished client experiences.",
        }),
      ],
    });
  });

  it("defaults enhanced spacer settings for old spacer blocks", () => {
    const blocks = parseBlocks([{ id: "space", type: "spacer", size: "md" }]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "space",
      type: "spacer",
      size: "md",
      mobileSize: "same",
      customHeight: 112,
      mobileCustomHeight: 112,
      backgroundMode: "none",
      backgroundWidth: "full",
    });
  });

  it("defaults enhanced divider settings for old divider blocks", () => {
    const blocks = parseBlocks([{ id: "rule", type: "divider" }]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "rule",
      type: "divider",
      style: "solid",
      thickness: "hairline",
      width: "content",
      align: "center",
      spacing: "normal",
      colorMode: "border",
      backgroundMode: "none",
      label: "",
    });
  });
});
