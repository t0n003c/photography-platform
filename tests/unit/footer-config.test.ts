import { describe, expect, it } from "vitest";
import {
  DEFAULT_FOOTER_CONFIG,
  normalizeFooterConfig,
  normalizeFooterHref,
  normalizeStickyFooterColumns,
} from "@/src/lib/footer-config";

describe("footer config", () => {
  it("defaults missing values", () => {
    expect(normalizeFooterConfig(null)).toEqual(DEFAULT_FOOTER_CONFIG);
  });

  it("keeps custom sticky footer columns and links", () => {
    const config = normalizeFooterConfig({
      layout: "sticky",
      text: "Studio footer",
      stickyColumns: [
        {
          id: "column-work",
          label: "Work",
          links: [
            { id: "portfolio", label: "Portfolio", href: "galleries" },
            {
              id: "ig",
              label: "Instagram",
              href: "https://instagram.com/studio",
              openInNewTab: true,
            },
          ],
        },
        {
          id: "empty",
          label: "",
          links: [],
        },
      ],
    });

    expect(config.layout).toBe("sticky");
    expect(config.stickyColumns).toEqual([
      {
        id: "column-work",
        label: "Work",
        links: [
          {
            id: "portfolio",
            label: "Portfolio",
            href: "/galleries",
            openInNewTab: false,
          },
          {
            id: "ig",
            label: "Instagram",
            href: "https://instagram.com/studio",
            openInNewTab: true,
          },
        ],
      },
    ]);
  });

  it("normalizes footer hrefs", () => {
    expect(normalizeFooterHref("about")).toBe("/about");
    expect(normalizeFooterHref("/about")).toBe("/about");
    expect(normalizeFooterHref("#contact")).toBe("#contact");
    expect(normalizeFooterHref("mailto:hello@example.com")).toBe(
      "mailto:hello@example.com",
    );
    expect(normalizeFooterHref("")).toBe("#");
  });

  it("drops blank columns and blank links", () => {
    expect(
      normalizeStickyFooterColumns([
        { id: "blank", label: "", links: [] },
        {
          id: "company",
          label: "Company",
          links: [{ id: "blank-link", label: "", href: "/about" }],
        },
      ]),
    ).toEqual([{ id: "company", label: "Company", links: [] }]);
  });
});
