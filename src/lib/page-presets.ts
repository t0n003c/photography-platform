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

const BANNER_PRISMA_DEFAULTS = {
  prismaVideoUrl: "",
  prismaShowAsterisk: true,
  agencyVideoUrl: "",
  agencyAccentText: "",
  slides: [],
  minimalSliderAutoplay: false,
  minimalSliderAutoplayMs: 4500,
};

const GALLERY_TORA_PROPS_DEFAULTS = {
  toraPropsShowBackground: true,
  toraPropsBackgroundColor: "#252626",
  toraPropsCaptionColor: "#edd8aa",
  toraPropsShowCaptions: true,
  toraPropsCaptionSource: "auto",
} as const;

// Starter blocks per page type. `gen` returns a fresh unique id per block.
export function presetBlocks(type: PageType, gen: () => string): Block[] {
  switch (type) {
    case "portfolio":
      return [
        { id: gen(), type: "banner", source: "featured", photoId: null, photoIds: [], eyebrow: "", typewriterWords: "", headline: "Selected work", subhead: "", height: "tall", overlay: "auto", focalX: 50, focalY: 50, zoom: 1, layout: "bottom-left", headlineFont: "sans", headlineSize: "lg", headlineTracking: "normal", headlineCase: "normal", buttonStyle: "solid", effect: "none", ...BANNER_PRISMA_DEFAULTS },
        { id: gen(), type: "gallery", source: "featured", targetId: null, gridType: "masonry", spacing: "normal", autoplay: false, backdrop: "color", limit: 12, effect: "none", effectSpeed: 1, filterMode: "none", showOverlayText: true, sortMode: "source", manualOrderPhotoIds: [], filterSorts: [], customFilters: [], ...GALLERY_TORA_PROPS_DEFAULTS },
        { id: gen(), type: "cta", headline: "Like what you see?", buttonLabel: "Get in touch", buttonHref: "/contact", buttonStyle: "pill" },
      ];
    case "landing":
      return [
        { id: gen(), type: "banner", source: "featured", photoId: null, photoIds: [], eyebrow: "", typewriterWords: "", headline: "", subhead: "", height: "tall", overlay: "auto", focalX: 50, focalY: 50, zoom: 1, layout: "bottom-left", headlineFont: "sans", headlineSize: "lg", headlineTracking: "normal", headlineCase: "normal", buttonStyle: "solid", effect: "none", ...BANNER_PRISMA_DEFAULTS },
        {
          id: gen(),
          type: "columns",
          gap: "normal",
          colAlign: ["top", "top"],
          justify: "fill",
          columns: [
            [
              { id: gen(), type: "heading", text: "A short intro", level: 2, align: "left", font: "sans", spacing: "normal" },
              { id: gen(), type: "richtext", text: "Tell visitors who you are and what you do.", align: "left", font: "sans", size: "base" },
            ],
            [{ id: gen(), type: "image", photoId: null, width: "normal", rounded: true }],
          ],
        },
        { id: gen(), type: "gallery", source: "featured", targetId: null, gridType: "justified", spacing: "normal", autoplay: false, backdrop: "color", limit: 9, effect: "none", effectSpeed: 1, filterMode: "none", showOverlayText: true, sortMode: "source", manualOrderPhotoIds: [], filterSorts: [], customFilters: [], ...GALLERY_TORA_PROPS_DEFAULTS },
        { id: gen(), type: "cta", headline: "Book a session", buttonLabel: "Contact", buttonHref: "/contact", buttonStyle: "pill" },
      ];
    case "about":
      return [
        { id: gen(), type: "heading", text: "About the studio", level: 1, align: "left", font: "sans", spacing: "normal" },
        { id: gen(), type: "richtext", text: "Introduce yourself and your work here.", align: "left", font: "sans", size: "base" },
        { id: gen(), type: "cta", headline: "", buttonLabel: "Start a conversation", buttonHref: "/contact", buttonStyle: "pill" },
      ];
    case "journal":
      return [
        { id: gen(), type: "heading", text: "Journal", level: 1, align: "left", font: "sans", spacing: "normal" },
        { id: gen(), type: "richtext", text: "Write your first entry…", align: "left", font: "sans", size: "base" },
      ];
    case "contact":
      return [
        { id: gen(), type: "heading", text: "Get in touch", level: 1, align: "left", font: "sans", spacing: "normal" },
        { id: gen(), type: "richtext", text: "Tell visitors how to reach you.", align: "left", font: "sans", size: "base" },
        { id: gen(), type: "contactForm", style: "stacked", eyebrow: "Contact", heading: "Start a conversation", body: "Tell me about your session, event, or print order and I'll be in touch soon.", submitLabel: "Send message", align: "left" },
      ];
    case "standard":
    default:
      return [
        { id: gen(), type: "heading", text: "New page", level: 1, align: "left", font: "sans", spacing: "normal" },
        { id: gen(), type: "richtext", text: "Start writing…", align: "left", font: "sans", size: "base" },
      ];
  }
}

// Faithful reproduction of the original hand-built home page, as builder blocks.
export function homePresetBlocks(
  gen: () => string,
  opts: { headline: string; subhead: string },
): Block[] {
  return [
    { id: gen(), type: "banner", source: "featured", photoId: null, photoIds: [], eyebrow: "", typewriterWords: "", headline: opts.headline, subhead: opts.subhead, ctaLabel: "View portfolio", ctaHref: "/categories", height: "tall", overlay: "auto", focalX: 50, focalY: 50, zoom: 1, layout: "bottom-left", headlineFont: "sans", headlineSize: "lg", headlineTracking: "normal", headlineCase: "normal", buttonStyle: "solid", effect: "none", ...BANNER_PRISMA_DEFAULTS },
    { id: gen(), type: "gallery", source: "featured", targetId: null, gridType: "justified", spacing: "normal", autoplay: false, backdrop: "color", limit: 12, effect: "none", effectSpeed: 1, manualOrderPhotoIds: [], filterSorts: [], sortMode: "source", filterMode: "none", showOverlayText: true, customFilters: [], ...GALLERY_TORA_PROPS_DEFAULTS },
    { id: gen(), type: "categoryIndex", title: "By category" },
    { id: gen(), type: "locationIndex", title: "By location" },
    { id: gen(), type: "instagram", title: "From the field", count: 6 },
    { id: gen(), type: "cta", headline: "Photography that lasts", body: "Portraits, events, and the wild places in between — shot and delivered with care.", buttonLabel: "More about the studio", buttonHref: "/about", buttonStyle: "pill" },
  ];
}
