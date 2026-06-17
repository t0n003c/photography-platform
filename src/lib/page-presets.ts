import type { Block } from "@/src/lib/blocks";

export type PageType =
  | "standard"
  | "portfolio"
  | "landing"
  | "about"
  | "journal"
  | "contact";

export const PAGE_TYPES: { value: PageType; label: string; hint: string }[] = [
  { value: "standard", label: "Standard", hint: "A blank page with a heading and text." },
  { value: "portfolio", label: "Portfolio", hint: "Banner, gallery, and a call to action." },
  { value: "landing", label: "Landing", hint: "Banner, two columns, gallery, CTA." },
  { value: "about", label: "About", hint: "Heading, text, and a contact CTA." },
  { value: "journal", label: "Journal", hint: "Heading and long-form text." },
  { value: "contact", label: "Contact", hint: "Heading and intro text." },
];

// Starter blocks per page type. `gen` returns a fresh unique id per block.
export function presetBlocks(type: PageType, gen: () => string): Block[] {
  switch (type) {
    case "portfolio":
      return [
        { id: gen(), type: "banner", source: "featured", photoId: null, headline: "Selected work", subhead: "", height: "tall", overlay: "auto", focalX: 50, focalY: 50, zoom: 1, layout: "bottom-left", headlineFont: "sans", headlineSize: "lg", headlineTracking: "normal", headlineCase: "normal", buttonStyle: "solid", effect: "none" },
        { id: gen(), type: "gallery", source: "featured", targetId: null, gridType: "masonry", spacing: "normal", limit: 12, effect: "none" },
        { id: gen(), type: "cta", headline: "Like what you see?", buttonLabel: "Get in touch", buttonHref: "/contact" },
      ];
    case "landing":
      return [
        { id: gen(), type: "banner", source: "featured", photoId: null, headline: "", subhead: "", height: "tall", overlay: "auto", focalX: 50, focalY: 50, zoom: 1, layout: "bottom-left", headlineFont: "sans", headlineSize: "lg", headlineTracking: "normal", headlineCase: "normal", buttonStyle: "solid", effect: "none" },
        {
          id: gen(),
          type: "columns",
          gap: "normal",
          columns: [
            [
              { id: gen(), type: "heading", text: "A short intro", level: 2, align: "left" },
              { id: gen(), type: "richtext", text: "Tell visitors who you are and what you do.", align: "left" },
            ],
            [{ id: gen(), type: "image", photoId: null, width: "normal", rounded: true }],
          ],
        },
        { id: gen(), type: "gallery", source: "featured", targetId: null, gridType: "justified", spacing: "normal", limit: 9, effect: "none" },
        { id: gen(), type: "cta", headline: "Book a session", buttonLabel: "Contact", buttonHref: "/contact" },
      ];
    case "about":
      return [
        { id: gen(), type: "heading", text: "About the studio", level: 1, align: "left" },
        { id: gen(), type: "richtext", text: "Introduce yourself and your work here.", align: "left" },
        { id: gen(), type: "cta", headline: "", buttonLabel: "Start a conversation", buttonHref: "/contact" },
      ];
    case "journal":
      return [
        { id: gen(), type: "heading", text: "Journal", level: 1, align: "left" },
        { id: gen(), type: "richtext", text: "Write your first entry…", align: "left" },
      ];
    case "contact":
      return [
        { id: gen(), type: "heading", text: "Get in touch", level: 1, align: "left" },
        { id: gen(), type: "richtext", text: "Tell visitors how to reach you.", align: "left" },
      ];
    case "standard":
    default:
      return [
        { id: gen(), type: "heading", text: "New page", level: 1, align: "left" },
        { id: gen(), type: "richtext", text: "Start writing…", align: "left" },
      ];
  }
}

// Faithful reproduction of the original hand-built home page, as builder blocks.
export function homePresetBlocks(
  gen: () => string,
  opts: { headline: string; subhead: string },
): Block[] {
  return [
    { id: gen(), type: "banner", source: "featured", photoId: null, headline: opts.headline, subhead: opts.subhead, ctaLabel: "View portfolio", ctaHref: "/categories", height: "tall", overlay: "auto", focalX: 50, focalY: 50, zoom: 1, layout: "bottom-left", headlineFont: "sans", headlineSize: "lg", headlineTracking: "normal", headlineCase: "normal", buttonStyle: "solid", effect: "none" },
    { id: gen(), type: "gallery", source: "featured", targetId: null, gridType: "justified", spacing: "normal", limit: 12, effect: "none" },
    { id: gen(), type: "categoryIndex", title: "By category" },
    { id: gen(), type: "locationIndex", title: "By location" },
    { id: gen(), type: "instagram", title: "From the field", count: 6 },
    { id: gen(), type: "cta", headline: "Photography that lasts", body: "Portraits, events, and the wild places in between — shot and delivered with care.", buttonLabel: "More about the studio", buttonHref: "/about" },
  ];
}
