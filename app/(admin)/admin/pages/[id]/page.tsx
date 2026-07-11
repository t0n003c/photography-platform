"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Loader2,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Monitor,
  Smartphone,
  ExternalLink,
  RefreshCw,
  Crosshair,
  Settings,
  GripVertical,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/src/lib/api-client";
import { BLOCK_LABELS, type Block, type BlockType, type LeafBlock } from "@/src/lib/blocks";
import { PhotoPicker, type PhotoOption } from "@/components/admin/photo-picker";
import { FocalPointPicker } from "@/components/admin/focal-point-picker";
import {
  TORA_MOCHIE_DEFAULT_HEADLINE,
  TORA_MOCHIE_DEFAULT_TYPED_WORDS,
} from "@/components/blocks/toramochie-wall-grid";
import type { PhotoDTO } from "@/src/db/queries/photos";

interface PageRow {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: "draft" | "published";
  isHome: boolean;
  blocks: unknown;
  theme: "light" | "dark" | "auto" | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

interface Opt {
  id: string;
  label: string;
  photoCount?: number;
}

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

function swapAt<T>(arr: T[], i: number, j: number): T[] {
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function pxInput(value: string): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function BoundedNumberInput({
  value,
  min,
  max,
  fallback,
  onValueChange,
}: {
  value: number;
  min: number;
  max: number;
  fallback: number;
  onValueChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value ?? fallback));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(String(value ?? fallback));
    }
  }, [fallback, value]);

  const commit = useCallback(
    (rawValue: string) => {
      const next = clampInt(Number(rawValue), min, max, fallback);
      setDraft(String(next));
      onValueChange(next);
    },
    [fallback, max, min, onValueChange],
  );

  return (
    <Input
      type="number"
      min={min}
      max={max}
      step={1}
      value={draft}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(e) => {
        const nextDraft = e.target.value;
        setDraft(nextDraft);
        const nextValue = Number(nextDraft);
        if (
          Number.isFinite(nextValue) &&
          nextValue >= min &&
          nextValue <= max
        ) {
          onValueChange(Math.round(nextValue));
        }
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        commit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
    />
  );
}

// Scroll the live-preview iframe to a block and briefly highlight it. The iframe
// is same-origin, so we can reach into its document by the block's data-id.
function locateInPreview(blockId: string) {
  const iframe = document.getElementById("page-preview-iframe") as HTMLIFrameElement | null;
  const el = iframe?.contentDocument?.querySelector<HTMLElement>(
    `[data-block-id="${blockId}"]`,
  );
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("preview-locate");
  window.setTimeout(() => el.classList.remove("preview-locate"), 1600);
}

const newBlockId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `b-${Date.now()}-${Math.floor(performance.now())}`;

// Leaf block types offered in the top-level "add" menu (columns handled separately).
const ADD_BLOCK_GROUPS: { label: string; types: BlockType[] }[] = [
  {
    label: "Content",
    types: ["heading", "subheading", "richtext", "quote", "infoBlock", "faq"],
  },
  {
    label: "Media & galleries",
    types: [
      "image",
      "imageComparison",
      "featureCarousel",
      "bookSlider",
      "gallery",
      "banner",
      "portfolioList",
      "scrollShowcase",
    ],
  },
  {
    label: "Profile & proof",
    types: ["about", "testimonials", "team", "logos", "instagram"],
  },
  {
    label: "Commerce & conversion",
    types: ["pricing", "shop", "cta", "contactForm", "customLink"],
  },
  {
    label: "Indexes & maps",
    types: ["categoryIndex", "locationIndex", "locationMap"],
  },
  {
    label: "Layout",
    types: ["columns", "spacer", "divider"],
  },
];

function makeInfoBlockTab(index = 0) {
  const titles = ["COMMERCIAL", "PERSONAL", "EDITORIAL", "DESIGN"] as const;
  return {
    id: newBlockId(),
    title: titles[index % titles.length],
    text:
      "Floral Design is a full-service wedding and special event planning company with takes care of your floral, design and logistics needs.\n\nOur office is located in San Francisco, CA. Our goal, besides ensuring a flawless and magical event for you, is to make your planning.",
    photoId: null,
    accentPhotoId: null,
  };
}

function makeInfoBlockAccordionItem(index = 0) {
  const titles = ["DESCRIPTION", "ADDITIONAL INFO", "REVIEWS"] as const;
  return {
    id: newBlockId(),
    title: titles[index % titles.length],
    text:
      "Alienum phaedrum torquatos nec eu, vis detraxit periculis ex, nihil eros expetendis in mei.",
  };
}

function makeTestimonialItem() {
  return {
    id: newBlockId(),
    name: "Ashley Right",
    affiliation: "Pinterest",
    quote:
      "Professionals in their craft. Every image felt intentional, polished, and completely true to the day.",
    photoId: null,
  };
}

function makeBookSliderPage(index = 0) {
  return {
    id: newBlockId(),
    photoId: null,
    imageMode: "editorial" as const,
    headline: index === 0 ? "Opening frame" : `Story page ${index + 1}`,
    subhead:
      index === 0
        ? "A quiet introduction to the collection."
        : "Add a short line that supports this spread.",
    caption: "",
    linkLabel: "",
    linkHref: "",
  };
}

function makePortfolioListItem(index = 0) {
  const examples = [
    ["Free Feelings", "Women", "A quiet portrait story with soft motion and intimate color."],
    ["Purple of Mendy", "Women", "A saturated editorial frame built around movement and mood."],
    ["Behind you", "Women", "A small cinematic project with a warm low-light palette."],
    ["On the top", "Women", "A breezy outdoor story shaped by sky, gesture, and silhouette."],
    ["Under water", "Friendship", "A playful session with bright color and graphic composition."],
    ["Derek stopped", "Man", "A close portrait study with restrained atmosphere."],
    ["Another life", "Hugs", "An affectionate collection focused on connection."],
    ["Alisa's Fairy Tail", "Women", "A whimsical portrait sequence with a storybook edge."],
  ];
  const [title, category, description] = examples[index % examples.length];
  return {
    id: newBlockId(),
    title,
    category,
    description,
    linkLabel: "Read More",
    linkHref: "#",
    photoId: null,
    hoverPhotoId: null,
  };
}

function makeAboutLink(label = "Link", href = "#") {
  return {
    id: newBlockId(),
    label,
    href,
  };
}

function makeTeamMember(index = 0) {
  const examples = [
    [
      "Chadrack",
      "director of photography",
      "Chadrack shapes the visual language of every session with a calm eye for light, location, and story.",
    ],
    [
      "Mak VieSAinte",
      "FOUNDER",
      "Mak leads the creative direction and keeps each client experience focused, polished, and personal.",
    ],
    [
      "Osiris Balonga",
      "LEAD FRONT-END",
      "Osiris builds refined digital experiences that make every gallery feel fast, immersive, and considered.",
    ],
    [
      "Jacques",
      "PRODUCT OWNER",
      "Jacques turns client needs into practical workflows so each project moves cleanly from idea to delivery.",
    ],
    [
      "Riche Makso",
      "CTO - PRODUCT DESIGNER",
      "Riche blends product strategy and interaction design to keep the platform elegant under the surface.",
    ],
    [
      "Jemima",
      "MAKE-UP ARTISTE",
      "Jemima brings a precise, natural styling approach that helps every portrait subject feel camera-ready.",
    ],
  ] as const;
  const [name, role, description] = examples[index % examples.length];
  return {
    id: newBlockId(),
    name,
    role,
    description,
    photoId: null,
    twitterUrl: "",
    facebookUrl: "",
    linkedinUrl: "",
    instagramUrl: "",
    behanceUrl: "",
  };
}

function makeTeamHiringLink(index = 0) {
  const examples = [
    ["PRODUCER", "STRONG MAN"],
    ["STYLIST", "BEAUTY GIRL"],
    ["ASSISTENT", "FAST MAN"],
  ] as const;
  const [title, subtitle] = examples[index % examples.length];
  return {
    id: newBlockId(),
    title,
    subtitle,
    href: "#",
  };
}

function makePricingFeature(text = "Feature", tooltip = "", included = true) {
  return {
    id: newBlockId(),
    text,
    tooltip,
    included,
  };
}

function makePricingPlan(index = 0) {
  const plans = [
    {
      name: "Basic",
      info: "For most individuals",
      photoId: null,
      mediaPhotoId: null,
      mediaVideoUrl: "",
      monthlyPrice: 7,
      yearlyPrice: 74,
      priceLabel: "",
      highlighted: false,
      ctaLabel: "Start Your Free Trial",
      ctaHref: "#",
      features: [
        makePricingFeature("Up to 3 Blog posts"),
        makePricingFeature("Up to 3 Transcriptions"),
        makePricingFeature("Up to 3 Posts stored"),
        makePricingFeature("Markdown support", "Export content in Markdown format", false),
        makePricingFeature("Community support", "Get answers to your questions"),
        makePricingFeature("AI powered suggestions", "Get up to 100 AI powered suggestions", false),
      ],
    },
    {
      name: "Pro",
      info: "For small businesses",
      photoId: null,
      mediaPhotoId: null,
      mediaVideoUrl: "",
      monthlyPrice: 17.99,
      yearlyPrice: 190,
      priceLabel: "",
      highlighted: true,
      ctaLabel: "Get started",
      ctaHref: "#",
      features: [
        makePricingFeature("Up to 500 Blog Posts"),
        makePricingFeature("Up to 500 Transcriptions"),
        makePricingFeature("Up to 500 Posts stored"),
        makePricingFeature("Unlimited Markdown support", "Export content in Markdown format"),
        makePricingFeature("SEO optimization tools"),
        makePricingFeature("Priority support", "Get 24/7 chat support", false),
        makePricingFeature("AI powered suggestions", "Get up to 500 AI powered suggestions"),
      ],
    },
    {
      name: "Business",
      info: "For large organizations",
      photoId: null,
      mediaPhotoId: null,
      mediaVideoUrl: "",
      monthlyPrice: 69.99,
      yearlyPrice: 528,
      priceLabel: "Contact us",
      highlighted: false,
      ctaLabel: "Contact team",
      ctaHref: "#",
      features: [
        makePricingFeature("Unlimited Blog Posts"),
        makePricingFeature("Unlimited Transcriptions"),
        makePricingFeature("Unlimited Posts stored"),
        makePricingFeature("Unlimited Markdown support"),
        makePricingFeature("SEO optimization tools", "Advanced SEO optimization tools"),
        makePricingFeature("Priority support", "Get 24/7 chat support"),
        makePricingFeature("AI powered suggestions", "Get up to 500 AI powered suggestions"),
      ],
    },
  ];
  const plan = plans[index] ?? {
    name: "New plan",
    info: "For new clients",
    photoId: null,
    mediaPhotoId: null,
    mediaVideoUrl: "",
    monthlyPrice: 29,
    yearlyPrice: 299,
    priceLabel: "",
    highlighted: false,
    ctaLabel: "Get started",
    ctaHref: "#",
    features: [makePricingFeature("Feature")],
  };
  return {
    id: newBlockId(),
    ...plan,
  };
}

function makeDividerBlock(id: string): Extract<Block, { type: "divider" }> {
  return {
    id,
    type: "divider",
    style: "solid",
    thickness: "hairline",
    width: "content",
    align: "center",
    spacing: "normal",
    customSpacingTop: 32,
    customSpacingBottom: 32,
    colorMode: "border",
    color: "#d4d4d8",
    backgroundMode: "none",
    backgroundColor: "#f4f4f5",
    label: "",
  };
}

function makeLocationMapPin(index = 0) {
  return {
    id: newBlockId(),
    title: index === 0 ? "Custom pin" : `Custom pin ${index + 1}`,
    subtitle: "",
    lat: "",
    lng: "",
    photoId: null,
    linkLabel: "",
    linkHref: "",
  };
}

function makeLocationMapConnection(startId = "", endId = "") {
  return {
    id: newBlockId(),
    startId,
    endId,
  };
}

function makeCustomLinkItem(index = 0) {
  const defaults = [
    ["PORTRAITS", "BEST WORKS", "#"],
    ["JOURNAL", "DAILY STORIES", "#"],
    ["INVESTMENT", "CHECK PRICES", "#"],
  ] as const;
  const [title, subtitle, href] = defaults[index % defaults.length];
  return {
    id: newBlockId(),
    title,
    subtitle,
    href,
  };
}

function makeContactInfoItem(index = 0) {
  const defaults = [
    ["PHOTOSTUDIO", "231 Main Street Chicago, IL", "+1 312 229 9000"],
    ["OFFICE", "93 W Division Street Chicago, IL", "+1 312 943 0367"],
  ] as const;
  const [title, address, phone] = defaults[index % defaults.length];
  return {
    id: newBlockId(),
    title,
    address,
    phone,
    href: "",
  };
}

function makeContactSocialLink(index = 0) {
  const defaults = [
    ["Facebook", "#"],
    ["Instagram", "#"],
    ["Twitter", "#"],
  ] as const;
  const [label, href] = defaults[index % defaults.length];
  return {
    id: newBlockId(),
    label,
    href,
  };
}

function makeBannerSlide(index = 0, photoId: string | null = null) {
  const defaults = [
    ["for couples", "Another way"],
    ["for models", "Human feel"],
    ["for travels", "Ocean song"],
    ["for pleasure", "Golden place"],
  ] as const;
  const [subtitle, headline] = defaults[index % defaults.length];
  return {
    id: newBlockId(),
    photoId,
    subtitle,
    headline,
    buttonLabel: "Read More",
    buttonHref: "#",
  };
}

function makeFullWidthBannerSlide(index = 0, photoId: string | null = null) {
  const headlines = [
    "London's portraits",
    "Melbourne's portraits",
    "Porto's portraits",
    "Washington's portraits",
  ] as const;
  return {
    id: newBlockId(),
    photoId,
    subtitle: "",
    headline: headlines[index % headlines.length],
    buttonLabel: "",
    buttonHref: "#",
  };
}

const GALLERY_TORA_PROPS_DEFAULTS = {
  toraPropsShowBackground: true,
  toraPropsBackgroundColor: "#252626",
  toraPropsCaptionColor: "#edd8aa",
  toraPropsShowCaptions: true,
  toraPropsCaptionSource: "auto",
} as const;
const GALLERY_TORA_JUSTIFIED_DEFAULTS = {
  toraJustifiedUseBackground: true,
  toraJustifiedBackgroundColor: "#252626",
  toraJustifiedTitleColor: "#f7f7f7",
  toraJustifiedAccentColor: "#edd8aa",
  toraJustifiedTitleSource: "auto",
  toraJustifiedRowHeightFactor: 7,
  toraJustifiedDesktopGutter: 25,
  toraJustifiedMobileGutter: 15,
  toraJustifiedHoverInset: true,
  toraJustifiedDimOnLeadHover: true,
  toraJustifiedScrollOnSelect: true,
  toraJustifiedShowBlurredSideFill: true,
} as const;
const GALLERY_TORA_PORTFOLIO_DEFAULTS = {
  toraPortfolioFilterTextSize: 30,
  toraPortfolioSeparatorSize: 55,
} as const;
const TORA_HEADING_DEFAULT_LABELS: Record<string, string> = {
  "tora-classic": "HEADINGS",
  "tora-urban": "KNOW ME BETTER",
};
const TORA_CLIENT_WALL_DEFAULT_TITLE = "OUR HAPPY CLIENTS";
const TORA_CLIENT_WALL_DEFAULT_EYEBROW = "BEST CASES";
const TORA_CLIENT_WALL_DEFAULT_INTRO =
  "A selection of brands and creative partners we have been proud to photograph.";

function toraHeadingDefaultLabel(style: string | undefined) {
  return TORA_HEADING_DEFAULT_LABELS[style ?? ""] ?? "";
}

function makeBlock(type: BlockType): Block {
  const id = newBlockId();
  switch (type) {
    case "heading": return {
      id,
      type,
      text: "Heading",
      level: 2,
      align: "left",
      font: "sans",
      spacing: "normal",
      headingStyle: "default",
      label: "",
      body: "",
      linkHref: "",
      ctaLabel: "GET IN TOUCH",
      ctaHref: "#",
      markText: "R",
    };
    case "subheading": return { id, type, text: "Subheading", align: "left", font: "sans", spacing: "normal" };
    case "richtext": return { id, type, text: "", align: "left", font: "sans", size: "base" };
    case "image": return { id, type, photoId: null, width: "normal", rounded: true };
    case "portfolioList": return {
      id,
      type,
      style: "modern",
      eyebrow: "PORTFOLIO LIST",
      title: "MODERN",
      body: "",
      items: Array.from({ length: 8 }, (_, index) => makePortfolioListItem(index)),
      backgroundColor: "#242625",
      textColor: "#f8f3df",
      accentColor: "#d8c98d",
      showBackground: true,
    };
    case "about": return {
      id,
      type,
      layout: "simple",
      sectionEyebrow: "ABOUT",
      sectionTitle: "SIMPLE",
      eyebrow: "",
      headline: "HI, I'M REFLECTOR",
      body:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam leo sem, feugiat ut tincidunt a, vulputate sed mauris. Proin fringilla risus ut gravida ultrices. Ut mollis vel felis in sollicitudin.\n\nUt ac quam ante. Curabitur sollicitudin scelerisque est, eu commodo libero ornare in. Nam ac nunc sed dui semper vestibulum nec in nisi.",
      quote: "Cum sociis natoque penatibus et magnis disrient",
      ctaLabel: "learn more",
      ctaHref: "/about",
      primaryPhotoId: null,
      secondaryPhotoId: null,
      tertiaryPhotoId: null,
      contactTitle: "CONTACT",
      address: "231 Main Street Chicago, IL",
      phoneLabel: "Ph:",
      phoneNumber: "3122299000",
      facebookUrl: "",
      twitterUrl: "",
      instagramUrl: "",
      pressTitle: "PRESS",
      pressLinks: [
        makeAboutLink("Shoot Beyond like never before", "#"),
        makeAboutLink("Shoot Beyond like never before", "#"),
        makeAboutLink("How to make best photo", "#"),
      ],
      awardsTitle: "AWARDS",
      awardLinks: [
        makeAboutLink("International Photography Award", "#"),
        makeAboutLink("The Good Design Award", "#"),
      ],
      collaboratorsTitle: "COLLABORATORS",
      collaboratorsText:
        "The New York Times, Apple, Wired, Cosmopolitan, The Atlantic, The Undefeated, Fast Company, Washington Post, Slate, Texas Monthly Magazine, Red Music Academy, LA Magazine.",
      showContactForm: true,
      contactFormTitle: "CONTACT ME",
      submitLabel: "Send",
    };
    case "imageComparison": return {
      id,
      type,
      title: "Before and after",
      subtitle: "Drag the handle to compare the two versions.",
      leftPhotoId: null,
      rightPhotoId: null,
      leftLabel: "Before",
      rightLabel: "After",
      comparisonOrientation: "horizontal",
      initialPosition: 50,
      aspectRatio: "16-9",
      width: "wide",
      rounded: true,
      showcaseBackground: true,
      backgroundColor: "#f4f4f5",
      handleColor: "#ffffff",
    };
    case "featureCarousel": return {
      id,
      type,
      headline: "Edit Your Photos on the Go",
      highlightText: "Photos",
      highlightFrom: "#3b82f6",
      highlightTo: "#a855f7",
      subtitle: "Use all our AI-powered photo editing tools on your phone, available for all iOS and Android.",
      photoIds: [],
      autoplay: false,
      autoplayMs: 4500,
      showArrows: true,
      desktopVisibleCount: "3",
      imageRadius: "xl",
      primaryLabel: "",
      primaryHref: "",
      secondaryLabel: "",
      secondaryHref: "",
    };
    case "bookSlider": return {
      id,
      type,
      title: "Studio Lookbook",
      subtitle: "Click or drag the pages to browse this editorial-style book.",
      coverTitle: "Lookbook",
      coverSubtitle: "A curated story in motion",
      coverPhotoId: null,
      pages: [makeBookSliderPage(0), makeBookSliderPage(1), makeBookSliderPage(2)],
      size: "standard",
      pageStyle: "soft",
      paperTexture: true,
      showcaseBackground: true,
      showControls: true,
      showPageNumbers: true,
      shadowStrength: 0.45,
      backgroundColor: "#f7f1e8",
      textColor: "#2d251d",
      accentColor: "#8b5e34",
    };
    case "gallery": return { id, type, source: "featured", targetId: null, gridType: "justified", spacing: "normal", autoplay: false, backdrop: "color", limit: 12, effect: "none", effectSpeed: 1, filterMode: "none", filterStyle: "flip-reveal", showOverlayText: true, sortMode: "source", manualOrderPhotoIds: [], filterSorts: [], customFilters: [], ...GALLERY_TORA_PROPS_DEFAULTS, ...GALLERY_TORA_JUSTIFIED_DEFAULTS, ...GALLERY_TORA_PORTFOLIO_DEFAULTS };
    case "banner": return { id, type, source: "featured", photoId: null, photoIds: [], slides: [], minimalSliderAutoplay: false, minimalSliderAutoplayMs: 4500, fullWidthSliderAccentColor: "#f7f7f7", fullWidthSliderDimImages: true, eyebrow: "", typewriterWords: "", headline: "", subhead: "", height: "tall", overlay: "auto", layout: "bottom-left", focalX: 50, focalY: 50, zoom: 1, headlineFont: "sans", headlineSize: "lg", headlineTracking: "normal", headlineCase: "normal", buttonStyle: "solid", effect: "none", prismaVideoUrl: "", prismaShowAsterisk: true, agencyVideoUrl: "", agencyAccentText: "" };
    case "quote": return { id, type, text: "" };
    case "infoBlock": return {
      id,
      type,
      style: "creative",
      eyebrow: "INTERESTED TO",
      title: "COLLABORATION",
      text:
        "Place Seed was days doesn't void is living whales let waters without lights unto, you whose kind fourth Years place likeness years shall I bring them upon form, don't unto.",
      quote:
        "Forth seasons fill have. Yielding them and. Itself, moveth replenish Bearing fruit. Brougd living called.",
      photoId: null,
      secondaryPhotoId: null,
      dimPhoto: true,
      creativeTextLayout: "split",
      creativePhotoSize: "60",
      creativePhotoRatio: "auto",
      infoListTextPosition: "left",
      buttonLabel: "LET'S CONNECT",
      buttonHref: "#",
      tabs: [makeInfoBlockTab(0), makeInfoBlockTab(1), makeInfoBlockTab(2), makeInfoBlockTab(3)],
      accordionItems: [
        makeInfoBlockAccordionItem(0),
        makeInfoBlockAccordionItem(1),
        makeInfoBlockAccordionItem(2),
      ],
    };
    case "testimonials": return {
      id,
      type,
      layout: "slider",
      label: "Reviews",
      title: "See what all the talk is about!",
      subtitle: "Transformative client experience from all around the globe",
      gridPanel: true,
      gridColumns: "3",
      glassShowcaseBackground: true,
      glassShowcaseBackgroundColor: "#0d1324",
      autoplay: false,
      showThumbnails: true,
      items: [
        makeTestimonialItem(),
        {
          id: newBlockId(),
          name: "Jacob Jose",
          affiliation: "New York Times",
          quote: "The delivery was thoughtful, fast, and beautifully edited. It felt effortless from start to finish.",
          photoId: null,
        },
        {
          id: newBlockId(),
          name: "Elara Sands",
          affiliation: "Behance",
          quote: "The attention to detail was immaculate. Every frame carried the mood we hoped for.",
          photoId: null,
        },
      ],
    };
    case "team": return {
      id,
      type,
      title: "",
      layout: "showcase",
      cardPosition: "alternate",
      showCardArrow: true,
      creativeEyebrow: "O U R",
      creativeDescription: "Meet the people behind the images, edits, and client experience.",
      creativeLogo: "RAVI",
      creativeColumns: "3",
      creativeShowCardOutline: true,
      creativeCtaLabel: "REGISTER NOW",
      creativeCtaHref: "#",
      creativeShowMainSocials: true,
      creativeTwitterUrl: "#",
      creativeFacebookUrl: "#",
      creativeInstagramUrl: "#",
      creativeYoutubeUrl: "#",
      creativeWebsiteLabel: "www.website.com",
      creativeWebsiteHref: "#",
      marqueeSubtitle: "Meet the people behind the images, edits, and client experience.",
      marqueeSpeed: 32,
      marqueePauseOnHover: true,
      marqueeShowDecorations: true,
      marqueeShowQuote: true,
      marqueeQuote:
        "The care, communication, and delivery from this team made the entire experience feel effortless.",
      marqueeQuoteAuthor: "Natalia Kara",
      marqueeQuoteRole: "Studio client",
      marqueeQuotePhotoId: null,
      orbitSubtitle: "Select a team member from the orbit to learn more about their role.",
      orbitRingCount: "auto",
      orbitAutoplay: true,
      orbitSpeed: 5000,
      orbitPauseOnHover: true,
      orbitShowDots: true,
      orbitShowIconAccents: true,
      orbitButtonLabel: "Connect",
      orbitButtonHref: "#",
      toraCrewEyebrow: "MEET US",
      toraCrewShowHiring: true,
      toraCrewHiringTitle: "WE'RE HIRING",
      toraCrewHiringHref: "#",
      toraCrewHiringLinks: Array.from({ length: 3 }, (_, index) =>
        makeTeamHiringLink(index),
      ),
      grayscale: true,
      showSocials: true,
      members: Array.from({ length: 6 }, (_, index) => makeTeamMember(index)),
    };
    case "pricing": return {
      id,
      type,
      style: "standard",
      eyebrow: "",
      heading: "Plans that Scale with You",
      description: "Whether you're just starting out or growing fast, our flexible pricing has you covered - with no hidden costs.",
      currency: "$",
      defaultFrequency: "monthly",
      showBillingToggle: true,
      theme: "auto",
      showHighlightEffect: true,
      pricingSliderBackgroundPhotoId: null,
      pricingSliderOverlayOpacity: 0.5,
      pricingSliderHeadingSize: "reference",
      pricingSliderEyebrowSize: "reference",
      pricingSliderAutoplay: true,
      pricingSliderAutoplayMs: 5000,
      pricingSliderTransitionMs: 1500,
      castingImageRatio: "reference",
      plans: [makePricingPlan(0), makePricingPlan(1), makePricingPlan(2)],
    };
    case "shop": return {
      id,
      type,
      style: "tora-grid",
      title: "SHOP",
      body: "Browse prints, digital downloads, and curated bundles.",
      source: "all",
      category: "",
      limit: 12,
      showSidebar: true,
      showSearch: true,
      showTagCloud: true,
      showSorting: true,
      showSaleBadge: true,
      showPrices: true,
      theme: "auto",
      backgroundColor: "#252626",
      textColor: "#f7f7f7",
      accentColor: "#ddc59f",
    };
    case "cta": return { id, type, headline: "", buttonLabel: "Get in touch", buttonHref: "/contact", buttonStyle: "pill" };
    case "customLink": return {
      id,
      type,
      layout: "link-row",
      items: [makeCustomLinkItem(0), makeCustomLinkItem(1), makeCustomLinkItem(2)],
      buttonLabel: "More stories",
      buttonHref: "#",
      showBackground: false,
      backgroundColor: "#252626",
      textColor: "#f8f3df",
      accentColor: "#d8c98d",
    };
    case "contactForm": return {
      id,
      type,
      style: "stacked",
      eyebrow: "Contact",
      heading: "Get in touch",
      body: "Tell me about your session, event, or print order and I'll be in touch soon.",
      submitLabel: "Send message",
      align: "left",
      contactHeroPhotoId: null,
      contactHeroTitle: "CONTACTS",
      contactHeroOverlayOpacity: 0.45,
      contactInfoEyebrow: "CONTACT",
      contactInfoHeading: "CONTACT INFO",
      contactInfoIntro: "IF YOU NEED TO MESSAGE US, PLEASE FILL OUT THE FORM BELLOW",
      contactInfoItems: [makeContactInfoItem(0), makeContactInfoItem(1)],
      contactImageEyebrow: "CONTACT",
      contactImageHeading: "IMAGES WITH FORM",
      contactSocialLinks: [
        makeContactSocialLink(0),
        makeContactSocialLink(1),
        makeContactSocialLink(2),
      ],
      contactImagePhotoIds: [],
      contactSideCaption: "Designed by © REFLECTOR Studio. All Right Reserved 2019",
    };
    case "spacer": return {
      id,
      type,
      size: "md",
      mobileSize: "same",
      customHeight: 112,
      mobileCustomHeight: 112,
      backgroundMode: "none",
      backgroundColor: "#f4f4f5",
      backgroundWidth: "full",
    };
    case "divider": return makeDividerBlock(id);
    case "categoryIndex": return { id, type, title: "By category" };
    case "locationIndex": return { id, type, title: "By location" };
    case "locationMap": return {
      id,
      type,
      title: "Explore locations",
      subtitle: "Tap a marker to preview the work photographed in each place.",
      locationIds: [],
      customPins: [],
      displayMode: "interactive",
      height: "md",
      mapTheme: "auto",
      markerColor: "#f43f5e",
      showLabels: true,
      showControls: true,
      popupMode: "click",
      networkConnectionMode: "ordered",
      networkConnections: [],
      networkLineColor: "#0ea5e9",
      networkDotColor: "#f43f5e",
      networkMapDotColor: "#94a3b8",
      networkAnimationSeconds: 3.2,
      networkShowLabels: true,
      routeStyle: "planning",
      routeProvider: "osrm",
      routeTravelMode: "driving",
      routePointIds: [],
      routeStartId: "",
      routeEndId: "",
      routeShowAlternatives: true,
      routeShowCards: true,
      routeShowStopList: true,
      routeShowMapLinks: true,
      routeSummaryPosition: "top-left",
      routeSummaryStyle: "solid",
      routeShowLabels: true,
      routeLineColor: "#6366f1",
      routeInactiveLineColor: "#94a3b8",
      routeStartColor: "#22c55e",
      routeEndColor: "#ef4444",
    };
    case "scrollShowcase": return {
      id,
      type,
      title: "",
      categoryIds: [],
      limit: 6,
      clusterCount: 4,
      showTitles: true,
      style: "cinematic",
      scrollLayoutsVariant: "row",
      scrollLayoutsPhotoCount: 9,
      scrollLayoutsHeading: "Scroll layout morphs",
      scrollLayoutsIntroText: "Pinned image layouts morph between editorial compositions as you scroll.",
    };
    case "instagram": return { id, type, title: "From the field", count: 6 };
    case "faq": return { id, type, title: "Frequently asked questions", style: "accordion", align: "left", items: [{ q: "Your question?", a: "Your answer." }] };
    case "logos": return {
      id,
      type,
      title: "As featured in",
      eyebrow: TORA_CLIENT_WALL_DEFAULT_EYEBROW,
      intro: "",
      style: "row",
      grayscale: true,
      size: "md",
      spacing: "normal",
      photoIds: [],
    };
    case "columns": return { id, type, gap: "normal", columns: [[], []], colAlign: ["top", "top"], justify: "fill" };
    default: return makeDividerBlock(id);
  }
}

export default function PageEditor() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [page, setPage] = useState<PageRow | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<PhotoOption[]>([]);
  const [targets, setTargets] = useState<Record<string, Opt[]>>({ category: [], location: [], gallery: [] });
  const [settingsOpen, setSettingsOpen] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<{ data: PageRow }>(`/api/v1/admin/pages/${id}`),
      api.get<{ data: PhotoDTO[] }>("/api/v1/admin/photos?limit=80").catch(() => ({ data: [] as PhotoDTO[] })),
      api
        .get<{ data: { id: string; name: string; photoCount?: number }[] }>("/api/v1/admin/categories")
        .catch(() => ({ data: [] })),
      api.get<{ data: { id: string; name: string; photoCount?: number }[] }>("/api/v1/admin/locations").catch(() => ({ data: [] })),
      api.get<{ data: { id: string; title: string }[] }>("/api/v1/admin/galleries").catch(() => ({ data: [] })),
    ])
      .then(([p, ph, cats, locs, gals]) => {
        if (!active) return;
        setPage(p.data);
        setBlocks(Array.isArray(p.data.blocks) ? (p.data.blocks as Block[]) : []);
        setPhotos(
          ph.data.map((p) => {
            const webp = p.variants
              .filter((v) => v.format === "webp")
              .sort((a, b) => a.width - b.width);
            const thumb =
              webp.find((v) => v.sizeBucket === "thumb") ??
              webp[0] ??
              p.variants[0];
            return {
              id: p.id,
              label: p.altText || "Untitled photo",
              thumbUrl: thumb?.url ?? null,
            };
          }),
        );
        setTargets({
          category: cats.data.map((c) => ({ id: c.id, label: c.name, photoCount: c.photoCount ?? 0 })),
          location: locs.data.map((l) => ({ id: l.id, label: l.name, photoCount: l.photoCount ?? 0 })),
          gallery: gals.data.map((g) => ({ id: g.id, label: g.title })),
        });
      })
      .catch((err) => active && toast(errMsg(err), "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, toast]);

  const patch = (p: Partial<PageRow>) => setPage((prev) => (prev ? { ...prev, ...p } : prev));
  const updateBlock = (i: number, b: Block) =>
    setBlocks((prev) => prev.map((x, idx) => (idx === i ? b : x)));
  const moveBlock = (i: number, dir: -1 | 1) =>
    setBlocks((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const removeBlock = (i: number) => setBlocks((prev) => prev.filter((_, idx) => idx !== i));
  const addBlock = (type: BlockType) => setBlocks((prev) => [...prev, makeBlock(type)]);

  const save = async () => {
    if (!page) return;
    setSaving(true);
    try {
      await api.patch(`/api/v1/admin/pages/${id}`, {
        title: page.title,
        slug: page.slug,
        status: page.status,
        isHome: page.isHome,
        theme: page.theme,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        blocks,
      });
      toast("Saved", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !page) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 lg:flex lg:h-[calc(100dvh-6.5rem)] lg:flex-col lg:overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 lg:flex-none">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="min-w-0 break-words text-xl font-semibold">{page.title}</h1>
          <Badge tone={page.status === "published" ? "green" : "neutral"}>{page.status}</Badge>
          {page.isHome && <Badge tone="blue">Home</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => patch({ status: page.status === "published" ? "draft" : "published" })}
          >
            {page.status === "published" ? "Set draft" : "Mark published"}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:overflow-hidden">
        {/* Editor */}
        <div className="min-w-0 space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="p-0">
              <button
                type="button"
                onClick={() => setSettingsOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-[hsl(var(--muted))]/50 sm:p-5"
                aria-expanded={settingsOpen}
              >
                <CardTitle>Page settings</CardTitle>
                {settingsOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                )}
              </button>
            </CardHeader>
            {settingsOpen && (
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Title">
                    <Input value={page.title} onChange={(e) => patch({ title: e.target.value })} />
                  </Field>
                  <Field label="URL slug">
                    <Input value={page.slug} onChange={(e) => patch({ slug: e.target.value })} />
                  </Field>
                  <Field label="Theme">
                    <Select
                      value={page.theme ?? "auto"}
                      onChange={(e) => patch({ theme: e.target.value as PageRow["theme"] })}
                    >
                      <option value="auto">Auto</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </Select>
                  </Field>
                  <Field label="Set as home page">
                    <label className="flex h-9 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={page.isHome}
                        onChange={(e) => patch({ isHome: e.target.checked })}
                      />
                      Render at /
                    </label>
                  </Field>
                </div>
                <Field label="SEO title">
                  <Input
                    value={page.seoTitle ?? ""}
                    onChange={(e) => patch({ seoTitle: e.target.value })}
                  />
                </Field>
                <Field label="SEO description">
                  <Textarea
                    rows={2}
                    value={page.seoDescription ?? ""}
                    onChange={(e) => patch({ seoDescription: e.target.value })}
                  />
                </Field>
              </CardContent>
            )}
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Blocks</CardTitle>
              <AddBlockMenu onAdd={addBlock} />
            </CardHeader>
            <CardContent className="space-y-3">
              {blocks.length === 0 && (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  No blocks yet — add one to start building.
                </p>
              )}
              {blocks.map((block, i) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  photos={photos}
                  targets={targets}
                  onChange={(b) => updateBlock(i, b)}
                  onUp={() => moveBlock(i, -1)}
                  onDown={() => moveBlock(i, 1)}
                  onRemove={() => removeBlock(i)}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <PreviewPane id={id} blocks={blocks} theme={page.theme} slug={page.slug} />
      </div>
    </div>
  );
}

function AddBlockMenu({ onAdd }: { onAdd: (t: BlockType) => void }) {
  return (
    <div className="min-w-0 flex-1 sm:flex-none">
      <Select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) {
            onAdd(e.target.value as BlockType);
            e.target.value = "";
          }
        }}
        className="h-8"
      >
        <option value="">+ Add block…</option>
        {ADD_BLOCK_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.types.map((t) => (
              <option key={t} value={t}>
                {BLOCK_LABELS[t]}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </div>
  );
}

function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
      <div className="space-y-0.5">
        <h4 className="text-sm font-semibold">{title}</h4>
        {description && (
          <p className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function BlockCard({
  block,
  photos,
  targets,
  onChange,
  onUp,
  onDown,
  onRemove,
}: {
  block: Block;
  photos: PhotoOption[];
  targets: Record<string, Opt[]>;
  onChange: (b: Block) => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hidden = block.hidden ?? false;
  return (
    <div className={`min-w-0 rounded-lg border ${hidden ? "bg-[hsl(var(--muted))]/45 opacity-75" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-[1_1_12rem] text-left text-sm font-medium"
        >
          {BLOCK_LABELS[block.type]}
          {hidden && (
            <span className="ml-2 rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Hidden
            </span>
          )}
          <span className="ml-2 truncate text-xs font-normal text-[hsl(var(--muted-foreground))]">
            {blockSummary(block)}
          </span>
        </button>
        <button
          type="button"
          aria-label={hidden ? "Show block" : "Hide block"}
          title={hidden ? "Show block" : "Hide block"}
          onClick={() => onChange({ ...block, hidden: !hidden } as Block)}
          className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button type="button" aria-label="Locate in preview" title="Locate in preview" disabled={hidden} onClick={() => locateInPreview(block.id)} className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-30">
          <Crosshair className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Move up" onClick={onUp} className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
          <ChevronUp className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Move down" onClick={onDown} className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
          <ChevronDown className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Delete" onClick={onRemove} className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="border-t p-3">
          {block.type === "columns" ? (
            <ColumnsEditor block={block} photos={photos} targets={targets} onChange={onChange} />
          ) : (
            <LeafEditor block={block} photos={photos} targets={targets} onChange={onChange} />
          )}
        </div>
      )}
    </div>
  );
}

function blockSummary(block: Block): string {
  switch (block.type) {
    case "heading":
    case "subheading":
    case "richtext":
    case "quote":
      return block.text.slice(0, 40);
    case "infoBlock":
      return `${block.style} · ${block.title || block.eyebrow || "Info block"}`;
    case "featureCarousel":
      return `${block.photoIds.length} photos`;
    case "imageComparison": {
      const comparisonKind =
        block.comparisonOrientation === "vertical" ? "Vertical" : "Horizontal";
      return `${comparisonKind} · ${block.leftLabel || "Before"} / ${block.rightLabel || "After"}`;
    }
    case "about":
      return `${block.layout} · ${block.headline || block.sectionTitle || "About"}`;
    case "portfolioList":
      return `${block.style} · ${block.items.length} items`;
    case "gallery":
      return `${block.source} · ${block.gridType}`;
    case "banner":
      if (block.layout === "toramochie-minimal-slider") {
        return `Tora minimal slider · ${(block.slides ?? []).length} slides`;
      }
      if (block.layout === "toramochie-full-width-slider") {
        return `Tora full width slider · ${(block.slides ?? []).length} slides`;
      }
      return block.headline || block.source;
    case "testimonials":
      return `${block.items.length} reviews`;
    case "team":
      return `${block.members.length} members`;
    case "pricing":
      return `${block.plans.length} plans`;
    case "shop":
      return `${block.style} · ${block.source}${block.source === "category" && block.category ? ` · ${block.category}` : ""}`;
    case "cta":
      return block.headline || block.buttonLabel;
    case "customLink":
      return block.layout === "center-button"
        ? block.buttonLabel || "Custom link"
        : `${block.items.length} links`;
    case "contactForm":
      return `${block.style} · ${block.heading || "Contact"}`;
    case "columns":
      return `${block.columns.length} columns`;
    case "faq":
      return `${block.style} · ${block.items.length} questions`;
    case "logos":
      return `${block.style} · ${block.photoIds.length} logos`;
    case "spacer":
      return block.backgroundMode === "none"
        ? `${block.size} height`
        : `${block.size} height · ${block.backgroundMode} background`;
    case "divider":
      return block.label
        ? `${block.style} · "${block.label}"`
        : `${block.style} · ${block.width}`;
    case "scrollShowcase":
      return `${block.style ?? "cinematic"} · up to ${block.limit} categories`;
    case "locationMap":
      return `${block.displayMode === "dotted-network" ? "Dotted network" : block.displayMode === "route-planning" ? "Route planning" : "Interactive"} · ${block.locationIds.length || "all"} locations · ${(block.customPins ?? []).length} custom pins`;
    default:
      return "";
  }
}

function ColumnsEditor({
  block,
  photos,
  targets,
  onChange,
}: {
  block: Extract<Block, { type: "columns" }>;
  photos: PhotoOption[];
  targets: Record<string, Opt[]>;
  onChange: (b: Block) => void;
}) {
  const setColumns = (columns: LeafBlock[][]) => onChange({ ...block, columns });
  // Reorder a block within its column (dir -1 = up, +1 = down).
  const moveLeaf = (ci: number, li: number, dir: -1 | 1) =>
    setColumns(
      block.columns.map((c, idx) => {
        if (idx !== ci) return c;
        const j = li + dir;
        if (j < 0 || j >= c.length) return c;
        const next = [...c];
        [next[li], next[j]] = [next[j], next[li]];
        return next;
      }),
    );
  // Per-column vertical alignment (parallel to columns; missing = "top").
  const colAlign = block.colAlign ?? [];
  const alignOf = (ci: number): "top" | "center" | "bottom" => colAlign[ci] ?? "top";
  const setAlign = (ci: number, v: "top" | "center" | "bottom") => {
    const next = [...colAlign];
    while (next.length < block.columns.length) next.push("top");
    next[ci] = v;
    onChange({ ...block, colAlign: next });
  };
  const [alignCol, setAlignCol] = useState<number | null>(null);

  // Drag-and-drop column reordering (native HTML5 DnD via a grip handle, so it
  // doesn't fight with editing the inputs inside each column). colAlign is kept
  // parallel to columns through the move.
  const [dragCol, setDragCol] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<number | null>(null);
  const moveColumn = (from: number, to: number) => {
    if (from === to || to < 0 || to >= block.columns.length) return;
    const cols = [...block.columns];
    const aligns = [...colAlign];
    while (aligns.length < block.columns.length) aligns.push("top");
    const [c] = cols.splice(from, 1);
    const [a] = aligns.splice(from, 1);
    cols.splice(to, 0, c);
    aligns.splice(to, 0, a);
    onChange({ ...block, columns: cols, colAlign: aligns });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Field label="Gap">
          <Select value={block.gap} onChange={(e) => onChange({ ...block, gap: e.target.value as typeof block.gap })}>
            <option value="tight">Tight</option>
            <option value="normal">Normal</option>
            <option value="airy">Airy</option>
          </Select>
        </Field>
        <Field label="Distribute">
          <Select value={block.justify ?? "fill"} onChange={(e) => onChange({ ...block, justify: e.target.value as typeof block.justify })}>
            <option value="fill">Fill width</option>
            <option value="center">Center</option>
            <option value="spread">Spread</option>
          </Select>
        </Field>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...block, columns: [...block.columns, []], colAlign: [...colAlign, "top"] })}
          disabled={block.columns.length >= 4}
        >
          <Plus className="h-4 w-4" /> Column
        </Button>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${block.columns.length}, minmax(0,1fr))` }}>
        {block.columns.map((col, ci) => (
          <div
            key={ci}
            onDragOver={(e) => {
              if (dragCol === null) return;
              e.preventDefault();
              if (overCol !== ci) setOverCol(ci);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragCol !== null) moveColumn(dragCol, ci);
              setDragCol(null);
              setOverCol(null);
            }}
            className={`space-y-2 rounded border p-2 transition-colors ${
              dragCol === ci ? "opacity-50" : ""
            } ${overCol === ci && dragCol !== null && dragCol !== ci ? "border-[hsl(var(--ring))] bg-[hsl(var(--muted))]" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs font-medium">
                <button
                  type="button"
                  draggable
                  onDragStart={() => setDragCol(ci)}
                  onDragEnd={() => {
                    setDragCol(null);
                    setOverCol(null);
                  }}
                  aria-label={`Drag column ${ci + 1}`}
                  title="Drag to reorder column"
                  className="cursor-grab text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] active:cursor-grabbing"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
                Column {ci + 1}
              </span>
              <div className="flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
                <button
                  type="button"
                  aria-label="Column alignment"
                  title="Vertical alignment"
                  onClick={() => setAlignCol(alignCol === ci ? null : ci)}
                  className="hover:text-[hsl(var(--foreground))]"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Remove column"
                  onClick={() =>
                    onChange({ ...block, columns: block.columns.filter((_, idx) => idx !== ci), colAlign: colAlign.filter((_, idx) => idx !== ci) })
                  }
                  className="hover:text-[hsl(var(--foreground))]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {alignCol === ci && (
              <div className="rounded border bg-[hsl(var(--muted))] p-2">
                <Field label="Vertical align">
                  <Select value={alignOf(ci)} onChange={(e) => setAlign(ci, e.target.value as "top" | "center" | "bottom")}>
                    <option value="top">Top</option>
                    <option value="center">Center</option>
                    <option value="bottom">Bottom</option>
                  </Select>
                </Field>
              </div>
            )}
            {col.map((leaf, li) => (
              <div key={leaf.id} className={`rounded border p-2 ${leaf.hidden ? "bg-[hsl(var(--muted))]/45 opacity-75" : ""}`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs">
                    {BLOCK_LABELS[leaf.type]}
                    {leaf.hidden && (
                      <span className="ml-1 rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                        Hidden
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-0.5 text-[hsl(var(--muted-foreground))]">
                    <button
                      type="button"
                      aria-label={leaf.hidden ? "Show block" : "Hide block"}
                      title={leaf.hidden ? "Show block" : "Hide block"}
                      onClick={() =>
                        setColumns(
                          block.columns.map((c, idx) =>
                            idx === ci
                              ? c.map((x, k) =>
                                  k === li ? ({ ...x, hidden: !(x.hidden ?? false) } as LeafBlock) : x,
                                )
                              : c,
                          ),
                        )
                      }
                      className="p-0.5 hover:text-[hsl(var(--foreground))]"
                    >
                      {leaf.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={li === 0}
                      onClick={() => moveLeaf(ci, li, -1)}
                      className="p-0.5 hover:text-[hsl(var(--foreground))] disabled:opacity-30"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={li === col.length - 1}
                      onClick={() => moveLeaf(ci, li, 1)}
                      className="p-0.5 hover:text-[hsl(var(--foreground))] disabled:opacity-30"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() =>
                        setColumns(block.columns.map((c, idx) => (idx === ci ? c.filter((_, k) => k !== li) : c)))
                      }
                      className="p-0.5 hover:text-[hsl(var(--foreground))]"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <LeafEditor
                  block={leaf}
                  photos={photos}
                  targets={targets}
                  onChange={(nb) =>
                    setColumns(block.columns.map((c, idx) => (idx === ci ? c.map((x, k) => (k === li ? (nb as LeafBlock) : x)) : c)))
                  }
                />
              </div>
            ))}
            <Select
              defaultValue=""
              className="h-8"
              onChange={(e) => {
                if (!e.target.value) return;
                const nb = makeBlock(e.target.value as BlockType) as LeafBlock;
                setColumns(block.columns.map((c, idx) => (idx === ci ? [...c, nb] : c)));
                e.target.value = "";
              }}
            >
              <option value="">+ Add…</option>
              {(["heading", "subheading", "richtext", "image", "quote"] as BlockType[]).map((t) => (
                <option key={t} value={t}>
                  {BLOCK_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}

type GallerySortMode =
  | "source"
  | "newest"
  | "oldest"
  | "title-asc"
  | "title-desc"
  | "custom";

const GALLERY_SORT_OPTIONS: { value: GallerySortMode; label: string }[] = [
  { value: "source", label: "Source order" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title-asc", label: "Title A-Z" },
  { value: "title-desc", label: "Title Z-A" },
  { value: "custom", label: "Custom order" },
];

function moveId(ids: string[], index: number, delta: number): string[] {
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

function PhotoOrderList({
  photos,
  ids,
  onChange,
}: {
  photos: PhotoOption[];
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  if (ids.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
        No photos selected for manual order.
      </p>
    );
  }
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  return (
    <div className="space-y-1.5">
      {ids.map((id, index) => {
        const photo = byId.get(id);
        return (
          <div
            key={`${id}-${index}`}
            className="flex items-center gap-2 rounded-md border p-1.5"
          >
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-[hsl(var(--muted))]">
              {photo?.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.thumbUrl}
                  alt={photo.label}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <span className="min-w-0 flex-1 truncate text-xs">
              {photo?.label ?? id}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={index === 0}
              onClick={() => onChange(moveId(ids, index, -1))}
              aria-label="Move photo up"
              className="h-8 w-8"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={index === ids.length - 1}
              onClick={() => onChange(moveId(ids, index, 1))}
              aria-label="Move photo down"
              className="h-8 w-8"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(ids.filter((_, i) => i !== index))}
              aria-label="Remove from manual order"
              className="h-8 w-8"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function LeafEditor({
  block,
  photos,
  targets,
  onChange,
}: {
  block: LeafBlock;
  photos: PhotoOption[];
  targets: Record<string, Opt[]>;
  onChange: (b: LeafBlock) => void;
}) {
  const set = (patch: Partial<LeafBlock>) => onChange({ ...block, ...patch } as LeafBlock);
  switch (block.type) {
    case "heading": {
      const headingStyle = block.headingStyle ?? "default";
      const isToraHeading = headingStyle !== "default";
      const needsLabel = headingStyle === "tora-classic" || headingStyle === "tora-urban";
      const needsBody =
        headingStyle === "tora-creative" ||
        headingStyle === "tora-simple" ||
        headingStyle === "tora-urban";
      const needsCta = headingStyle === "tora-creative" || headingStyle === "tora-simple";
      const updateHeadingStyle = (nextStyle: typeof block.headingStyle) => {
        const nextHeadingStyle = nextStyle ?? "default";
        const nextLabel = toraHeadingDefaultLabel(nextHeadingStyle);
        const currentLabel = block.label?.trim() ?? "";
        const previousDefaultLabel = toraHeadingDefaultLabel(headingStyle);
        const shouldSeedLabel =
          Boolean(nextLabel) &&
          (!currentLabel || currentLabel === previousDefaultLabel);
        set({
          headingStyle: nextStyle,
          ...(shouldSeedLabel ? { label: nextLabel } : {}),
          ...(nextHeadingStyle !== "default" &&
          headingStyle === "default" &&
          (block.align ?? "left") === "left"
            ? { align: "center" as const }
            : {}),
        });
      };

      return (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Text">
              <Input value={block.text} onChange={(e) => set({ text: e.target.value })} />
            </Field>
            <Field label="Style">
              <Select
                value={headingStyle}
                onChange={(e) =>
                  updateHeadingStyle(e.target.value as typeof block.headingStyle)
                }
              >
                <option value="default">Default</option>
                <option value="tora-modern">Tora modern</option>
                <option value="tora-modern-link">Tora modern link</option>
                <option value="tora-classic">Tora classic label</option>
                <option value="tora-creative">Tora creative</option>
                <option value="tora-simple">Tora simple</option>
                <option value="tora-urban">Tora urban</option>
              </Select>
            </Field>
            <Field label="Level">
              <Select value={String(block.level)} onChange={(e) => set({ level: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6 })}>
                <option value="1">H1</option><option value="2">H2</option><option value="3">H3</option>
                <option value="4">H4</option><option value="5">H5</option><option value="6">H6</option>
              </Select>
            </Field>
            <AlignField value={block.align} onChange={(align) => set({ align })} />
            {!isToraHeading && (
              <FontField value={block.font ?? "sans"} onChange={(font) => set({ font })} />
            )}
            <SpacingField value={block.spacing ?? "normal"} onChange={(spacing) => set({ spacing })} />
          </div>

          {isToraHeading && (
            <div className="grid gap-2 sm:grid-cols-2">
              {needsLabel && (
                <Field label="Small label">
                  <Input
                    value={block.label?.trim() || toraHeadingDefaultLabel(headingStyle)}
                    onChange={(e) => set({ label: e.target.value })}
                  />
                </Field>
              )}
              {headingStyle === "tora-modern-link" && (
                <Field label="Title link">
                  <Input
                    value={block.linkHref ?? ""}
                    placeholder="/contact"
                    onChange={(e) => set({ linkHref: e.target.value })}
                  />
                </Field>
              )}
              {headingStyle === "tora-creative" && (
                <Field label="Monogram text">
                  <Input
                    value={block.markText ?? "R"}
                    maxLength={3}
                    onChange={(e) => set({ markText: e.target.value })}
                  />
                </Field>
              )}
              {needsBody && (
                <div className="sm:col-span-2">
                  <Field label="Body text">
                    <Textarea
                      rows={4}
                      value={block.body ?? ""}
                      onChange={(e) => set({ body: e.target.value })}
                    />
                  </Field>
                </div>
              )}
              {needsCta && (
                <>
                  <Field label="Button label">
                    <Input
                      value={block.ctaLabel ?? ""}
                      onChange={(e) => set({ ctaLabel: e.target.value })}
                    />
                  </Field>
                  <Field label="Button link">
                    <Input
                      value={block.ctaHref ?? ""}
                      placeholder="#"
                      onChange={(e) => set({ ctaHref: e.target.value })}
                    />
                  </Field>
                </>
              )}
            </div>
          )}
        </div>
      );
    }
    case "subheading":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Text"><Input value={block.text} onChange={(e) => set({ text: e.target.value })} /></Field>
          <FontField value={block.font ?? "sans"} onChange={(font) => set({ font })} />
          <SpacingField value={block.spacing ?? "normal"} onChange={(spacing) => set({ spacing })} />
          <AlignField value={block.align} onChange={(align) => set({ align })} />
        </div>
      );
    case "richtext":
      return (
        <div className="space-y-2">
          <Field label="Text (blank line = new paragraph)">
            <Textarea rows={4} value={block.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
          <div className="grid gap-2 sm:grid-cols-3">
            <FontField value={block.font ?? "sans"} onChange={(font) => set({ font })} />
            <Field label="Size">
              <Select value={block.size ?? "base"} onChange={(e) => set({ size: e.target.value as typeof block.size })}>
                <option value="sm">Small</option>
                <option value="base">Normal</option>
                <option value="lg">Large</option>
                <option value="xl">Extra large</option>
              </Select>
            </Field>
            <AlignField value={block.align} onChange={(align) => set({ align })} />
          </div>
        </div>
      );
    case "quote":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Quote"><Input value={block.text} onChange={(e) => set({ text: e.target.value })} /></Field>
          <Field label="Attribution"><Input value={block.cite ?? ""} onChange={(e) => set({ cite: e.target.value })} /></Field>
        </div>
      );
    case "infoBlock": {
      const tabs = block.tabs ?? [];
      const accordionItems = block.accordionItems ?? [];
      const normalizedInfoStyle =
        block.style === "creativeReference"
          ? "creative"
          : block.style === "infoListReference"
            ? "infoList"
            : block.style;
      const isCreativeStyle = normalizedInfoStyle === "creative";
      const isInfoListStyle = normalizedInfoStyle === "infoList";
      const creativeTextLayout =
        block.style === "creativeReference"
          ? "reference"
          : (block.creativeTextLayout ?? "split");
      const creativePhotoSize = block.creativePhotoSize ?? "60";
      const creativePhotoRatio = block.creativePhotoRatio ?? "auto";
      const infoListTextPosition =
        block.style === "infoListReference"
          ? "center"
          : (block.infoListTextPosition ?? "left");
      const needsPhoto = isCreativeStyle || isInfoListStyle;
      const showsPhotoDimming =
        isInfoListStyle || (isCreativeStyle && creativeTextLayout === "reference");
      const usesButton =
        isCreativeStyle ||
        normalizedInfoStyle === "classic" ||
        normalizedInfoStyle === "simple";
      const usesTitle =
        isCreativeStyle ||
        isInfoListStyle ||
        normalizedInfoStyle === "classic" ||
        normalizedInfoStyle === "textStyle" ||
        normalizedInfoStyle === "modern";
      const usesEyebrow =
        isCreativeStyle ||
        normalizedInfoStyle === "tabs" ||
        normalizedInfoStyle === "textStyle" ||
        normalizedInfoStyle === "simple" ||
        normalizedInfoStyle === "modern";
      const usesText =
        normalizedInfoStyle !== "quote" &&
        normalizedInfoStyle !== "accordion";
      const usesQuote = normalizedInfoStyle === "quote" || normalizedInfoStyle === "modern";
      const updateTab = (index: number, patch: Partial<(typeof tabs)[number]>) => {
        set({ tabs: tabs.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
      };
      const updateAccordionItem = (
        index: number,
        patch: Partial<(typeof accordionItems)[number]>,
      ) => {
        set({
          accordionItems: accordionItems.map((item, i) =>
            i === index ? { ...item, ...patch } : item,
          ),
        });
      };
      const updateInfoStyle = (style: typeof normalizedInfoStyle) => {
        const patch: Partial<typeof block> = { style };
        if (style === "creative") {
          patch.creativeTextLayout =
            block.style === "creativeReference" ? "reference" : creativeTextLayout;
          patch.creativePhotoSize = creativePhotoSize;
          patch.creativePhotoRatio = creativePhotoRatio;
        }
        if (style === "infoList") {
          patch.infoListTextPosition =
            block.style === "infoListReference" ? "center" : infoListTextPosition;
        }
        if (style === "tabs" && tabs.length === 0) {
          patch.tabs = [
            makeInfoBlockTab(0),
            makeInfoBlockTab(1),
            makeInfoBlockTab(2),
            makeInfoBlockTab(3),
          ];
          if (!block.eyebrow.trim()) patch.eyebrow = "WHAT I LOVE TO SHOOT";
        }
        if (style === "accordion" && accordionItems.length === 0) {
          patch.accordionItems = [
            makeInfoBlockAccordionItem(0),
            makeInfoBlockAccordionItem(1),
            makeInfoBlockAccordionItem(2),
          ];
        }
        if (style === "quote" && !block.quote.trim()) {
          patch.quote =
            "Orure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.";
        }
        if (style === "simple" && !block.eyebrow.trim()) {
          patch.eyebrow = "ABOUT ME";
        }
        if (style === "modern" && !block.eyebrow.trim()) {
          patch.eyebrow = "PHOTOGRAPHER / TRAVELLER";
        }
        set(patch);
      };

      return (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Style">
              <Select
                value={normalizedInfoStyle}
                onChange={(e) => updateInfoStyle(e.target.value as typeof normalizedInfoStyle)}
              >
                <option value="creative">Creative</option>
                <option value="simpleText">Simple text</option>
                <option value="quote">Quote</option>
                <option value="infoList">Info list</option>
                <option value="classic">Classic</option>
                <option value="tabs">Tabs style</option>
                <option value="textStyle">Text style</option>
                <option value="accordion">Accordion</option>
                <option value="simple">Simple</option>
                <option value="modern">Modern</option>
              </Select>
            </Field>
            {isCreativeStyle && (
              <Field label="Text layout">
                <Select
                  value={creativeTextLayout}
                  onChange={(e) => {
                    const nextLayout = e.target.value as typeof creativeTextLayout;
                    set({
                      style: "creative",
                      creativeTextLayout: nextLayout,
                      ...(nextLayout === "reference" && creativeTextLayout !== "reference"
                        ? { dimPhoto: false }
                        : {}),
                    });
                  }}
                >
                  <option value="split">Side panel</option>
                  <option value="reference">Centered panel</option>
                </Select>
              </Field>
            )}
            {isCreativeStyle && (
              <Field label="Photo size">
                <Select
                  value={creativePhotoSize}
                  onChange={(e) =>
                    set({
                      style: "creative",
                      creativePhotoSize: e.target.value as typeof creativePhotoSize,
                    })
                  }
                >
                  <option value="50">Small photo</option>
                  <option value="60">Reference photo</option>
                  <option value="70">Large photo</option>
                </Select>
              </Field>
            )}
            {isCreativeStyle && (
              <Field label="Photo ratio">
                <Select
                  value={creativePhotoRatio}
                  onChange={(e) =>
                    set({
                      style: "creative",
                      creativePhotoRatio: e.target.value as typeof creativePhotoRatio,
                    })
                  }
                >
                  <option value="auto">Auto</option>
                  <option value="4-5">4:5</option>
                  <option value="1-1">1:1</option>
                  <option value="16-9">16:9</option>
                  <option value="3-2">3:2</option>
                  <option value="2-3">2:3</option>
                </Select>
              </Field>
            )}
            {isInfoListStyle && (
              <Field label="Text position">
                <Select
                  value={infoListTextPosition}
                  onChange={(e) => {
                    const nextPosition = e.target.value as typeof infoListTextPosition;
                    set({
                      style: "infoList",
                      infoListTextPosition: nextPosition,
                      ...(nextPosition === "center" && infoListTextPosition !== "center"
                        ? { dimPhoto: true }
                        : {}),
                    });
                  }}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                </Select>
              </Field>
            )}
            {usesEyebrow && (
              <Field label={normalizedInfoStyle === "tabs" ? "Intro heading" : "Small label"}>
                <Input value={block.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} />
              </Field>
            )}
            {usesTitle && (
              <Field label="Title">
                <Input value={block.title} onChange={(e) => set({ title: e.target.value })} />
              </Field>
            )}
            {usesQuote && (
              <Field label="Quote">
                <Textarea rows={3} value={block.quote} onChange={(e) => set({ quote: e.target.value })} />
              </Field>
            )}
          </div>

          {usesText && (
            <Field label="Text">
              <Textarea rows={4} value={block.text} onChange={(e) => set({ text: e.target.value })} />
            </Field>
          )}

          {needsPhoto && (
            <>
              <Field label="Image">
                <PhotoPicker photos={photos} value={block.photoId ?? null} onChange={(pid) => set({ photoId: pid })} />
              </Field>
              {showsPhotoDimming && (
                <Field label="Photo dimming">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.dimPhoto ?? true}
                      onChange={(e) => set({ dimPhoto: e.target.checked })}
                    />
                    Dim photo overlay
                  </label>
                </Field>
              )}
            </>
          )}

          {normalizedInfoStyle === "modern" && (
            <Field label="Signature image">
              <PhotoPicker photos={photos} value={block.secondaryPhotoId ?? null} onChange={(pid) => set({ secondaryPhotoId: pid })} />
            </Field>
          )}

          {usesButton && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Button label">
                <Input value={block.buttonLabel} onChange={(e) => set({ buttonLabel: e.target.value })} />
              </Field>
              <Field label="Button link">
                <Input value={block.buttonHref} onChange={(e) => set({ buttonHref: e.target.value })} />
              </Field>
            </div>
          )}

          {normalizedInfoStyle === "tabs" && (
            <div className="space-y-2">
              {tabs.map((item, index) => (
                <div key={item.id} className="space-y-2 rounded border p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Tab {index + 1}</span>
                    <div className="flex items-center gap-0.5 text-[hsl(var(--muted-foreground))]">
                      <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => set({ tabs: swapAt(tabs, index, index - 1) })} className="p-0.5 hover:text-[hsl(var(--foreground))] disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label="Move down" disabled={index === tabs.length - 1} onClick={() => set({ tabs: swapAt(tabs, index, index + 1) })} className="p-0.5 hover:text-[hsl(var(--foreground))] disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label="Remove" onClick={() => set({ tabs: tabs.filter((_, i) => i !== index) })} className="p-0.5 hover:text-[hsl(var(--foreground))]"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Title">
                      <Input value={item.title} onChange={(e) => updateTab(index, { title: e.target.value })} />
                    </Field>
                    <Field label="Text">
                      <Textarea rows={3} value={item.text} onChange={(e) => updateTab(index, { text: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Main image">
                    <PhotoPicker photos={photos} value={item.photoId ?? null} onChange={(pid) => updateTab(index, { photoId: pid })} containerClassName="max-h-44" />
                  </Field>
                  <Field label="Accent image">
                    <PhotoPicker photos={photos} value={item.accentPhotoId ?? null} onChange={(pid) => updateTab(index, { accentPhotoId: pid })} containerClassName="max-h-44" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => set({ tabs: [...tabs, makeInfoBlockTab(tabs.length)] })}>
                <Plus className="h-4 w-4" /> Tab
              </Button>
            </div>
          )}

          {normalizedInfoStyle === "accordion" && (
            <div className="space-y-2">
              {accordionItems.map((item, index) => (
                <div key={item.id} className="space-y-2 rounded border p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Row {index + 1}</span>
                    <div className="flex items-center gap-0.5 text-[hsl(var(--muted-foreground))]">
                      <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => set({ accordionItems: swapAt(accordionItems, index, index - 1) })} className="p-0.5 hover:text-[hsl(var(--foreground))] disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label="Move down" disabled={index === accordionItems.length - 1} onClick={() => set({ accordionItems: swapAt(accordionItems, index, index + 1) })} className="p-0.5 hover:text-[hsl(var(--foreground))] disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label="Remove" onClick={() => set({ accordionItems: accordionItems.filter((_, i) => i !== index) })} className="p-0.5 hover:text-[hsl(var(--foreground))]"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <Field label="Title">
                    <Input value={item.title} onChange={(e) => updateAccordionItem(index, { title: e.target.value })} />
                  </Field>
                  <Field label="Text">
                    <Textarea rows={3} value={item.text} onChange={(e) => updateAccordionItem(index, { text: e.target.value })} />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => set({ accordionItems: [...accordionItems, makeInfoBlockAccordionItem(accordionItems.length)] })}>
                <Plus className="h-4 w-4" /> Row
              </Button>
            </div>
          )}
        </div>
      );
    }
    case "testimonials": {
      const items = block.items ?? [];
      const testimonialLayout = block.layout ?? "slider";
      const updateItem = (
        index: number,
        patch: Partial<(typeof items)[number]>,
      ) => {
        set({
          items: items.map((item, i) =>
            i === index ? { ...item, ...patch } : item,
          ),
        });
      };
      return (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Layout">
              <Select
                value={testimonialLayout}
                onChange={(e) =>
                  set({ layout: e.target.value as typeof block.layout })
                }
              >
                <option value="slider">Slider</option>
                <option value="portrait-grid">Portrait cards grid</option>
                <option value="retro-carousel">Retro carousel</option>
                <option value="glass-stack">Glass card stack</option>
                <option value="tora-gold-urban">Tora gold urban</option>
              </Select>
            </Field>
            {testimonialLayout === "slider" ? (
              <>
                <Field label="Side label">
                  <Input
                    value={block.label}
                    onChange={(e) => set({ label: e.target.value })}
                  />
                </Field>
                <Field label="Thumbnail rail">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.showThumbnails ?? true}
                      onChange={(e) => set({ showThumbnails: e.target.checked })}
                    />
                    Show thumbnails
                  </label>
                </Field>
                <Field label="Auto-roll">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.autoplay ?? false}
                      onChange={(e) => set({ autoplay: e.target.checked })}
                    />
                    Advance slides
                  </label>
                </Field>
              </>
            ) : testimonialLayout === "portrait-grid" ? (
              <>
                <Field label="Section title">
                  <Input
                    value={block.title ?? ""}
                    onChange={(e) => set({ title: e.target.value })}
                  />
                </Field>
                <Field label="Dark panel">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.gridPanel ?? true}
                      onChange={(e) => set({ gridPanel: e.target.checked })}
                    />
                    Rounded showcase
                  </label>
                </Field>
                <Field label="Columns">
                  <Select
                    value={block.gridColumns ?? "3"}
                    onChange={(e) =>
                      set({ gridColumns: e.target.value as typeof block.gridColumns })
                    }
                  >
                    <option value="3">3 columns</option>
                    <option value="2">2 columns</option>
                  </Select>
                </Field>
                <div className="sm:col-span-3">
                  <Field label="Subtitle">
                    <Input
                      value={block.subtitle ?? ""}
                      onChange={(e) => set({ subtitle: e.target.value })}
                    />
                  </Field>
                </div>
              </>
            ) : testimonialLayout === "glass-stack" ? (
              <>
                <Field label="Showcase background">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.glassShowcaseBackground ?? true}
                      onChange={(e) =>
                        set({ glassShowcaseBackground: e.target.checked })
                      }
                    />
                    Use background
                  </label>
                </Field>
                {(block.glassShowcaseBackground ?? true) && (
                  <Field label="Background color">
                    <Input
                      type="color"
                      value={block.glassShowcaseBackgroundColor ?? "#0d1324"}
                      onChange={(e) =>
                        set({ glassShowcaseBackgroundColor: e.target.value })
                      }
                    />
                  </Field>
                )}
                <Field label="Auto-roll">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.autoplay ?? false}
                      onChange={(e) => set({ autoplay: e.target.checked })}
                    />
                    Advance slides
                  </label>
                </Field>
              </>
            ) : testimonialLayout === "tora-gold-urban" ? (
              <>
                <Field label="Section title">
                  <Input
                    value={block.title ?? ""}
                    onChange={(e) => set({ title: e.target.value })}
                  />
                </Field>
                <Field label="Auto-roll">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.autoplay ?? false}
                      onChange={(e) => set({ autoplay: e.target.checked })}
                    />
                    Advance slides
                  </label>
                </Field>
              </>
            ) : (
              <>
                <Field label="Auto-roll">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.autoplay ?? false}
                      onChange={(e) => set({ autoplay: e.target.checked })}
                    />
                    Advance slides
                  </label>
                </Field>
              </>
            )}
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                    Review {index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={() => set({ items: swapAt(items, index, index - 1) })}
                      aria-label="Move testimonial up"
                      className="h-8 w-8"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === items.length - 1}
                      onClick={() => set({ items: swapAt(items, index, index + 1) })}
                      aria-label="Move testimonial down"
                      className="h-8 w-8"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        set({ items: items.filter((_, i) => i !== index) })
                      }
                      aria-label="Remove testimonial"
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-[13rem_1fr]">
                  <Field label="Portrait">
                    <PhotoPicker
                      photos={photos}
                      value={item.photoId ?? null}
                      onChange={(photoId) => updateItem(index, { photoId })}
                      containerClassName="max-h-48"
                    />
                  </Field>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Name">
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(index, { name: e.target.value })}
                      />
                    </Field>
                    <Field label="Affiliation">
                      <Input
                        value={item.affiliation}
                        onChange={(e) =>
                          updateItem(index, { affiliation: e.target.value })
                        }
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Quote">
                        <Textarea
                          rows={4}
                          value={item.quote}
                          onChange={(e) =>
                            updateItem(index, { quote: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => set({ items: [...items, makeTestimonialItem()] })}
          >
            <Plus className="h-4 w-4" />
            Add testimonial
          </Button>
        </div>
      );
    }
    case "team": {
      const members = block.members ?? [];
      const teamLayout = block.layout ?? "showcase";
      const isEditorial = teamLayout === "memberCards";
      const isMarquee = teamLayout === "marqueeCards";
      const isCreative = teamLayout === "creativeSection";
      const isOrbit = teamLayout === "orbitCarousel";
      const isToraCrew = teamLayout === "toraCrew";
      const isShowcase = teamLayout === "showcase";
      const updateMember = (
        index: number,
        patch: Partial<(typeof members)[number]>,
      ) => {
        set({
          members: members.map((member, i) =>
            i === index ? { ...member, ...patch } : member,
          ),
        });
      };
      const hiringLinks = block.toraCrewHiringLinks ?? [];
      const updateHiringLink = (
        index: number,
        patch: Partial<(typeof hiringLinks)[number]>,
      ) => {
        set({
          toraCrewHiringLinks: hiringLinks.map((link, linkIndex) =>
            linkIndex === index ? { ...link, ...patch } : link,
          ),
        });
      };
      return (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Field
              label="Optional title"
              hint="Leave empty to match the reference layout."
            >
              <Input
                value={block.title ?? ""}
                onChange={(e) => set({ title: e.target.value })}
              />
            </Field>
            <Field label="Team layout">
              <Select
                value={block.layout ?? "showcase"}
                onChange={(e) =>
                  set({ layout: e.target.value as typeof block.layout })
                }
              >
                <option value="showcase">Showcase list</option>
                <option value="memberCards">Editorial member cards</option>
                <option value="marqueeCards">Marquee team cards</option>
                <option value="creativeSection">Creative team section</option>
                <option value="orbitCarousel">Orbit carousel</option>
                <option value="toraCrew">Tora crew grid</option>
              </Select>
            </Field>
            {isEditorial ? (
              <Field label="Card side">
                <Select
                  value={block.cardPosition ?? "alternate"}
                  onChange={(e) =>
                    set({
                      cardPosition: e.target.value as typeof block.cardPosition,
                    })
                  }
                >
                  <option value="alternate">Alternate left/right</option>
                  <option value="left">Image left</option>
                  <option value="right">Image right</option>
                </Select>
              </Field>
            ) : isMarquee ? (
              <Field label="Marquee speed">
                <Input
                  type="number"
                  min={12}
                  max={80}
                  value={block.marqueeSpeed ?? 32}
                  onChange={(e) => set({ marqueeSpeed: Number(e.target.value) })}
                />
              </Field>
            ) : isCreative ? (
              <Field label="Main social row">
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={block.creativeShowMainSocials ?? true}
                    onChange={(e) =>
                      set({ creativeShowMainSocials: e.target.checked })
                    }
                  />
                  Show website and icons
                </label>
              </Field>
            ) : isOrbit ? (
              <Field label="Orbit rings">
                <Select
                  value={block.orbitRingCount ?? "auto"}
                  onChange={(e) =>
                    set({ orbitRingCount: e.target.value as typeof block.orbitRingCount })
                  }
                >
                  <option value="auto">Auto by team size</option>
                  <option value="1">1 circle</option>
                  <option value="2">2 circles</option>
                  <option value="3">3 circles</option>
                </Select>
              </Field>
            ) : isToraCrew ? (
              <Field label="Top label">
                <Input
                  value={block.toraCrewEyebrow ?? ""}
                  onChange={(e) => set({ toraCrewEyebrow: e.target.value })}
                />
              </Field>
            ) : (
              <Field label="Portrait treatment">
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={block.grayscale ?? true}
                    onChange={(e) => set({ grayscale: e.target.checked })}
                  />
                  Grayscale until active
                </label>
              </Field>
            )}
            {isEditorial ? (
              <Field label="Circular arrow">
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={block.showCardArrow ?? true}
                    onChange={(e) => set({ showCardArrow: e.target.checked })}
                  />
                  Show card arrow
                </label>
              </Field>
            ) : isMarquee ? (
              <Field label="Marquee behavior">
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={block.marqueePauseOnHover ?? true}
                    onChange={(e) => set({ marqueePauseOnHover: e.target.checked })}
                  />
                  Pause on hover
                </label>
              </Field>
            ) : isCreative ? (
              <Field label="Member social links">
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={block.showSocials ?? true}
                    onChange={(e) => set({ showSocials: e.target.checked })}
                  />
                  Show on cards
                </label>
              </Field>
            ) : isOrbit ? (
              <Field label="Autoplay">
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={block.orbitAutoplay ?? true}
                    onChange={(e) => set({ orbitAutoplay: e.target.checked })}
                  />
                  Auto rotate members
                </label>
              </Field>
            ) : isToraCrew ? (
              <Field label="Portrait socials">
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={block.showSocials ?? true}
                    onChange={(e) => set({ showSocials: e.target.checked })}
                  />
                  Show on portrait cards
                </label>
              </Field>
            ) : (
              <Field label="Social links">
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={block.showSocials ?? true}
                    onChange={(e) => set({ showSocials: e.target.checked })}
                  />
                  Show on active member
                </label>
              </Field>
            )}
            {isToraCrew && (
              <Field label="Hiring section">
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={block.toraCrewShowHiring ?? true}
                    onChange={(e) => set({ toraCrewShowHiring: e.target.checked })}
                  />
                  Show below crew grid
                </label>
              </Field>
            )}
            {isMarquee && (
              <Field label="Portrait treatment">
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={block.grayscale ?? true}
                    onChange={(e) => set({ grayscale: e.target.checked })}
                  />
                  Grayscale until hover
                </label>
              </Field>
            )}
            {isShowcase && (
              <Field label="Editorial cards">
                <p className="flex h-9 items-center text-xs text-[hsl(var(--muted-foreground))]">
                  Switch layout to edit bio text.
                </p>
              </Field>
            )}
          </div>
          {isOrbit && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Intro text">
                    <Textarea
                      rows={2}
                      value={block.orbitSubtitle ?? ""}
                      onChange={(e) => set({ orbitSubtitle: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Autoplay speed">
                  <Input
                    type="number"
                    min={2000}
                    max={15000}
                    step={250}
                    value={block.orbitSpeed ?? 5000}
                    onChange={(e) =>
                      set({
                        orbitSpeed: Math.max(
                          2000,
                          Math.min(15000, pxInput(e.target.value)),
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="Pause on hover">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.orbitPauseOnHover ?? true}
                      onChange={(e) => set({ orbitPauseOnHover: e.target.checked })}
                    />
                    Pause autoplay
                  </label>
                </Field>
                <Field label="Progress dots">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.orbitShowDots ?? true}
                      onChange={(e) => set({ orbitShowDots: e.target.checked })}
                    />
                    Show below orbit
                  </label>
                </Field>
                <Field label="Animated icons">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.orbitShowIconAccents ?? true}
                      onChange={(e) =>
                        set({ orbitShowIconAccents: e.target.checked })
                      }
                    />
                    Show card accents
                  </label>
                </Field>
                <Field label="Button label">
                  <Input
                    value={block.orbitButtonLabel ?? ""}
                    onChange={(e) => set({ orbitButtonLabel: e.target.value })}
                  />
                </Field>
                <Field label="Button link">
                  <Input
                    value={block.orbitButtonHref ?? ""}
                    onChange={(e) => set({ orbitButtonHref: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          )}
          {isCreative && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Eyebrow">
                  <Input
                    value={block.creativeEyebrow ?? ""}
                    onChange={(e) => set({ creativeEyebrow: e.target.value })}
                  />
                </Field>
                <Field label="Logo text">
                  <Input
                    value={block.creativeLogo ?? ""}
                    onChange={(e) => set({ creativeLogo: e.target.value })}
                  />
                </Field>
                <Field label="Desktop columns">
                  <Select
                    value={block.creativeColumns ?? "3"}
                    onChange={(e) =>
                      set({
                        creativeColumns: e.target
                          .value as typeof block.creativeColumns,
                      })
                    }
                  >
                    <option value="3">3 columns</option>
                    <option value="4">4 columns</option>
                  </Select>
                </Field>
                <Field label="Card outline">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.creativeShowCardOutline ?? true}
                      onChange={(e) =>
                        set({ creativeShowCardOutline: e.target.checked })
                      }
                    />
                    Show rectangle outline
                  </label>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Intro text">
                    <Textarea
                      rows={3}
                      value={block.creativeDescription ?? ""}
                      onChange={(e) =>
                        set({ creativeDescription: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <Field label="Button label">
                  <Input
                    value={block.creativeCtaLabel ?? ""}
                    onChange={(e) => set({ creativeCtaLabel: e.target.value })}
                  />
                </Field>
                <Field label="Button link">
                  <Input
                    value={block.creativeCtaHref ?? ""}
                    onChange={(e) => set({ creativeCtaHref: e.target.value })}
                  />
                </Field>
                <Field label="Website label">
                  <Input
                    value={block.creativeWebsiteLabel ?? ""}
                    onChange={(e) =>
                      set({ creativeWebsiteLabel: e.target.value })
                    }
                  />
                </Field>
                <Field label="Website link">
                  <Input
                    value={block.creativeWebsiteHref ?? ""}
                    onChange={(e) => set({ creativeWebsiteHref: e.target.value })}
                  />
                </Field>
                <Field label="X / Twitter URL">
                  <Input
                    value={block.creativeTwitterUrl ?? ""}
                    onChange={(e) => set({ creativeTwitterUrl: e.target.value })}
                  />
                </Field>
                <Field label="Facebook URL">
                  <Input
                    value={block.creativeFacebookUrl ?? ""}
                    onChange={(e) => set({ creativeFacebookUrl: e.target.value })}
                  />
                </Field>
                <Field label="Instagram URL">
                  <Input
                    value={block.creativeInstagramUrl ?? ""}
                    onChange={(e) =>
                      set({ creativeInstagramUrl: e.target.value })
                    }
                  />
                </Field>
                <Field label="YouTube URL">
                  <Input
                    value={block.creativeYoutubeUrl ?? ""}
                    onChange={(e) => set({ creativeYoutubeUrl: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          )}
          {isToraCrew && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Hiring title">
                  <Input
                    value={block.toraCrewHiringTitle ?? ""}
                    onChange={(e) => set({ toraCrewHiringTitle: e.target.value })}
                    disabled={block.toraCrewShowHiring === false}
                  />
                </Field>
                <Field label="Hiring title link">
                  <Input
                    value={block.toraCrewHiringHref ?? ""}
                    onChange={(e) => set({ toraCrewHiringHref: e.target.value })}
                    disabled={block.toraCrewShowHiring === false}
                  />
                </Field>
              </div>
              {block.toraCrewShowHiring !== false && (
                <div className="space-y-2">
                  {hiringLinks.map((link, index) => (
                    <div
                      key={link.id}
                      className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
                    >
                      <Field label="Job title">
                        <Input
                          value={link.title ?? ""}
                          onChange={(e) =>
                            updateHiringLink(index, { title: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Sub title">
                        <Input
                          value={link.subtitle ?? ""}
                          onChange={(e) =>
                            updateHiringLink(index, { subtitle: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Link">
                        <Input
                          value={link.href ?? ""}
                          onChange={(e) =>
                            updateHiringLink(index, { href: e.target.value })
                          }
                        />
                      </Field>
                      <div className="flex items-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === 0}
                          onClick={() =>
                            set({
                              toraCrewHiringLinks: swapAt(
                                hiringLinks,
                                index,
                                index - 1,
                              ),
                            })
                          }
                          aria-label="Move hiring link up"
                          className="h-9 w-9"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === hiringLinks.length - 1}
                          onClick={() =>
                            set({
                              toraCrewHiringLinks: swapAt(
                                hiringLinks,
                                index,
                                index + 1,
                              ),
                            })
                          }
                          aria-label="Move hiring link down"
                          className="h-9 w-9"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            set({
                              toraCrewHiringLinks: hiringLinks.filter(
                                (_, linkIndex) => linkIndex !== index,
                              ),
                            })
                          }
                          aria-label="Remove hiring link"
                          className="h-9 w-9"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      set({
                        toraCrewHiringLinks: [
                          ...hiringLinks,
                          makeTeamHiringLink(hiringLinks.length),
                        ],
                      })
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add hiring link
                  </Button>
                </div>
              )}
            </div>
          )}
          {isMarquee && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Intro text">
                    <Textarea
                      rows={2}
                      value={block.marqueeSubtitle ?? ""}
                      onChange={(e) => set({ marqueeSubtitle: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Decorative marks">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.marqueeShowDecorations ?? true}
                      onChange={(e) =>
                        set({ marqueeShowDecorations: e.target.checked })
                      }
                    />
                    Show reference scribbles
                  </label>
                </Field>
                <Field label="Bottom quote">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.marqueeShowQuote ?? true}
                      onChange={(e) => set({ marqueeShowQuote: e.target.checked })}
                    />
                    Show quote section
                  </label>
                </Field>
              </div>
              {block.marqueeShowQuote !== false && (
                <div className="grid gap-3 lg:grid-cols-[13rem_1fr]">
                  <Field label="Quote avatar">
                    <PhotoPicker
                      photos={photos}
                      value={block.marqueeQuotePhotoId ?? null}
                      onChange={(photoId) => set({ marqueeQuotePhotoId: photoId })}
                      containerClassName="max-h-48"
                    />
                  </Field>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Field label="Quote text">
                        <Textarea
                          rows={3}
                          value={block.marqueeQuote ?? ""}
                          onChange={(e) => set({ marqueeQuote: e.target.value })}
                        />
                      </Field>
                    </div>
                    <Field label="Quote author">
                      <Input
                        value={block.marqueeQuoteAuthor ?? ""}
                        onChange={(e) => set({ marqueeQuoteAuthor: e.target.value })}
                      />
                    </Field>
                    <Field label="Quote role">
                      <Input
                        value={block.marqueeQuoteRole ?? ""}
                        onChange={(e) => set({ marqueeQuoteRole: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="space-y-3">
            {members.map((member, index) => (
              <div key={member.id} className="rounded-lg border p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                    Member {index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={() => set({ members: swapAt(members, index, index - 1) })}
                      aria-label="Move member up"
                      className="h-8 w-8"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === members.length - 1}
                      onClick={() => set({ members: swapAt(members, index, index + 1) })}
                      aria-label="Move member down"
                      className="h-8 w-8"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        set({ members: members.filter((_, i) => i !== index) })
                      }
                      aria-label="Remove member"
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-[13rem_1fr]">
                  <Field label="Portrait">
                    <PhotoPicker
                      photos={photos}
                      value={member.photoId ?? null}
                      onChange={(photoId) => updateMember(index, { photoId })}
                      containerClassName="max-h-48"
                    />
                  </Field>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Name">
                      <Input
                        value={member.name}
                        onChange={(e) => updateMember(index, { name: e.target.value })}
                      />
                    </Field>
                    <Field label="Role">
                      <Input
                        value={member.role}
                        onChange={(e) => updateMember(index, { role: e.target.value })}
                      />
                    </Field>
                    {(isEditorial || isOrbit) && (
                      <div className="sm:col-span-2">
                        <Field label="Bio">
                          <Textarea
                            rows={3}
                            value={member.description ?? ""}
                            onChange={(e) =>
                              updateMember(index, { description: e.target.value })
                            }
                          />
                        </Field>
                      </div>
                    )}
                    <Field label="X / Twitter URL">
                      <Input
                        value={member.twitterUrl ?? ""}
                        onChange={(e) =>
                          updateMember(index, { twitterUrl: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Facebook URL">
                      <Input
                        value={member.facebookUrl ?? ""}
                        onChange={(e) =>
                          updateMember(index, { facebookUrl: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="LinkedIn URL">
                      <Input
                        value={member.linkedinUrl ?? ""}
                        onChange={(e) =>
                          updateMember(index, { linkedinUrl: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Instagram URL">
                      <Input
                        value={member.instagramUrl ?? ""}
                        onChange={(e) =>
                          updateMember(index, { instagramUrl: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Behance URL">
                      <Input
                        value={member.behanceUrl ?? ""}
                        onChange={(e) =>
                          updateMember(index, { behanceUrl: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              set({ members: [...members, makeTeamMember(members.length)] })
            }
          >
            <Plus className="h-4 w-4" />
            Add member
          </Button>
        </div>
      );
    }
    case "pricing": {
      const plans = block.plans ?? [];
      const updatePlan = (
        index: number,
        patch: Partial<(typeof plans)[number]>,
      ) => {
        set({
          plans: plans.map((plan, i) =>
            i === index ? { ...plan, ...patch } : plan,
          ),
        });
      };
      const updateFeature = (
        planIndex: number,
        featureIndex: number,
        patch: Partial<(typeof plans)[number]["features"][number]>,
      ) => {
        const plan = plans[planIndex];
        if (!plan) return;
        updatePlan(planIndex, {
          features: plan.features.map((feature, i) =>
            i === featureIndex ? { ...feature, ...patch } : feature,
          ),
        });
      };
      const setPlanPrice = (
        index: number,
        key: "monthlyPrice" | "yearlyPrice",
        value: string,
      ) => {
        const next = Number(value);
        updatePlan(index, { [key]: Number.isFinite(next) ? next : 0 });
      };
      const isCastingServices = block.style === "tora-casting-services";
      const isPricingSlider = block.style === "tora-pricing-slider";
      const isPriceListStyle1 = block.style === "tora-price-list-style-1";
      const updatePricingStyle = (style: typeof block.style) => {
        const patch: Partial<typeof block> = { style };
        if (style === "tora-price-list-style-1") {
          if (
            !block.heading.trim() ||
            block.heading.trim() === "Plans that Scale with You"
          ) {
            patch.heading = "SAVE YOUR HISTORY";
          }
          if (
            !block.description.trim() ||
            block.description.trim() ===
              "Whether you're just starting out or growing fast, our flexible pricing has you covered - with no hidden costs."
          ) {
            patch.description = "";
          }
          patch.theme = block.theme === "auto" ? "dark" : block.theme;
          patch.showBillingToggle = false;
        }
        if (style === "tora-pricing-slider") {
          if (!block.eyebrow.trim()) patch.eyebrow = "CHOOSE OWN";
          if (
            !block.heading.trim() ||
            block.heading.trim() === "Plans that Scale with You"
          ) {
            patch.heading = "PRICING TABLE";
          }
          patch.theme = block.theme === "auto" ? "dark" : block.theme;
          patch.showBillingToggle = false;
          patch.pricingSliderAutoplay ??= true;
          patch.pricingSliderAutoplayMs ??= 5000;
          patch.pricingSliderTransitionMs ??= 1500;
          patch.pricingSliderOverlayOpacity ??= 0.5;
          patch.pricingSliderHeadingSize ??= "reference";
          patch.pricingSliderEyebrowSize ??= "reference";
        }
        set(patch);
      };

      return (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Pricing style">
              <Select
                value={block.style ?? "standard"}
                onChange={(e) =>
                  updatePricingStyle(e.target.value as typeof block.style)
                }
              >
                <option value="standard">Standard cards</option>
                <option value="glass-gradient">Glass gradient</option>
                <option value="tora-classic">Tora classic image cards</option>
                <option value="tora-creative">Tora creative full bleed</option>
                <option value="tora-modern">Tora modern packages</option>
                <option value="tora-simple">Tora simple banner</option>
                <option value="tora-with-media">Tora with media</option>
                <option value="tora-image-background">Tora image background</option>
                <option value="tora-price-list-style-1">
                  Tora price list style 1
                </option>
                <option value="tora-pricing-slider">Tora pricing slider</option>
                <option value="tora-price-list-style-3">
                  Tora price list style 3
                </option>
                <option value="tora-casting-services">Tora casting services</option>
              </Select>
            </Field>
            <Field label="Heading">
              <Input
                value={block.heading ?? ""}
                onChange={(e) => set({ heading: e.target.value })}
              />
            </Field>
            {isPricingSlider && (
              <Field label="Small label">
                <Input
                  value={block.eyebrow ?? ""}
                  onChange={(e) => set({ eyebrow: e.target.value })}
                />
              </Field>
            )}
            {!isCastingServices && (
              <Field label="Currency">
                <Input
                  value={block.currency ?? "$"}
                  onChange={(e) => set({ currency: e.target.value })}
                />
              </Field>
            )}
            <Field label="Theme">
              <Select
                value={block.theme ?? "auto"}
                onChange={(e) => set({ theme: e.target.value as typeof block.theme })}
              >
                <option value="auto">Auto</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </Select>
            </Field>
            {isCastingServices && (
              <Field label="Photo ratio">
                <Select
                  value={block.castingImageRatio ?? "reference"}
                  onChange={(e) =>
                    set({
                      castingImageRatio:
                        e.target.value as typeof block.castingImageRatio,
                    })
                  }
                >
                  <option value="reference">Reference 541:373</option>
                  <option value="wide">Wide 16:9</option>
                  <option value="landscape">Landscape 4:3</option>
                  <option value="square">Square 1:1</option>
                  <option value="portrait">Portrait 4:5</option>
                </Select>
              </Field>
            )}
            {isPricingSlider && (
              <div className="sm:col-span-2 lg:col-span-4">
                <div className="grid gap-3 rounded-lg border p-3 lg:grid-cols-2">
                  <Field label="Background image">
                    <PhotoPicker
                      photos={photos}
                      value={block.pricingSliderBackgroundPhotoId ?? null}
                      onChange={(pricingSliderBackgroundPhotoId) =>
                        set({ pricingSliderBackgroundPhotoId })
                      }
                      containerClassName="max-h-56"
                    />
                  </Field>
                  <div className="grid content-start gap-2 sm:grid-cols-2">
                    <Field label="Overlay opacity">
                      <Input
                        type="number"
                        min={0}
                        max={0.85}
                        step={0.05}
                        value={block.pricingSliderOverlayOpacity ?? 0.5}
                        onChange={(e) =>
                          set({
                            pricingSliderOverlayOpacity: Math.max(
                              0,
                              Math.min(0.85, Number(e.target.value) || 0),
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field label="Default period">
                      <Select
                        value={block.defaultFrequency ?? "monthly"}
                        onChange={(e) =>
                          set({
                            defaultFrequency: e.target
                              .value as typeof block.defaultFrequency,
                          })
                        }
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </Select>
                    </Field>
                    <Field label="Heading size">
                      <Select
                        value={block.pricingSliderHeadingSize ?? "reference"}
                        onChange={(e) =>
                          set({
                            pricingSliderHeadingSize:
                              e.target
                                .value as typeof block.pricingSliderHeadingSize,
                          })
                        }
                      >
                        <option value="small">Extra small</option>
                        <option value="reference">Small</option>
                        <option value="large">Medium</option>
                        <option value="oversized">Large</option>
                      </Select>
                    </Field>
                    <Field label="Small label size">
                      <Select
                        value={block.pricingSliderEyebrowSize ?? "reference"}
                        onChange={(e) =>
                          set({
                            pricingSliderEyebrowSize:
                              e.target
                                .value as typeof block.pricingSliderEyebrowSize,
                          })
                        }
                      >
                        <option value="small">Small</option>
                        <option value="reference">Reference</option>
                        <option value="large">Large</option>
                        <option value="oversized">Oversized</option>
                      </Select>
                    </Field>
                    <Field label="Autoplay">
                      <label className="flex h-9 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={block.pricingSliderAutoplay ?? true}
                          onChange={(e) =>
                            set({ pricingSliderAutoplay: e.target.checked })
                          }
                        />
                        Auto-advance
                      </label>
                    </Field>
                    <Field label="Autoplay delay">
                      <Input
                        type="number"
                        min={1200}
                        max={12000}
                        step={100}
                        value={block.pricingSliderAutoplayMs ?? 5000}
                        onChange={(e) =>
                          set({
                            pricingSliderAutoplayMs: Math.max(
                              1200,
                              Math.min(12000, pxInput(e.target.value)),
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field label="Transition speed">
                      <Input
                        type="number"
                        min={300}
                        max={3000}
                        step={100}
                        value={block.pricingSliderTransitionMs ?? 1500}
                        onChange={(e) =>
                          set({
                            pricingSliderTransitionMs: Math.max(
                              300,
                              Math.min(3000, pxInput(e.target.value)),
                            ),
                          })
                        }
                      />
                    </Field>
                  </div>
                </div>
              </div>
            )}
            <div className="sm:col-span-2 lg:col-span-4">
              <Field label="Description">
                <Textarea
                  rows={2}
                  value={block.description ?? ""}
                  onChange={(e) => set({ description: e.target.value })}
                />
              </Field>
            </div>
            {!isCastingServices && !isPricingSlider && !isPriceListStyle1 && (
              <>
                <Field label="Billing toggle">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.showBillingToggle ?? true}
                      onChange={(e) => set({ showBillingToggle: e.target.checked })}
                    />
                    Show monthly/yearly
                  </label>
                </Field>
                <Field label="Default period">
                  <Select
                    value={block.defaultFrequency ?? "monthly"}
                    onChange={(e) =>
                      set({
                        defaultFrequency: e.target
                          .value as typeof block.defaultFrequency,
                      })
                    }
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </Select>
                </Field>
                <Field label="Popular effect">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.showHighlightEffect ?? true}
                      onChange={(e) => set({ showHighlightEffect: e.target.checked })}
                    />
                    Animated border
                  </label>
                </Field>
              </>
            )}
          </div>

          <div className="space-y-3">
            {plans.map((plan, planIndex) => (
              <div key={plan.id} className="rounded-lg border p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                    {isCastingServices
                      ? "Offering"
                      : isPriceListStyle1 && planIndex < 2
                        ? "Package"
                        : isPriceListStyle1 && planIndex === 2
                          ? "Featured package"
                          : isPriceListStyle1
                            ? "Editorial row"
                            : "Plan"}{" "}
                    {planIndex + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={planIndex === 0}
                      onClick={() =>
                        set({ plans: swapAt(plans, planIndex, planIndex - 1) })
                      }
                      aria-label="Move plan up"
                      className="h-8 w-8"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={planIndex === plans.length - 1}
                      onClick={() =>
                        set({ plans: swapAt(plans, planIndex, planIndex + 1) })
                      }
                      aria-label="Move plan down"
                      className="h-8 w-8"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        set({ plans: plans.filter((_, i) => i !== planIndex) })
                      }
                      aria-label="Remove plan"
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Name">
                    <Input
                      value={plan.name}
                      onChange={(e) => updatePlan(planIndex, { name: e.target.value })}
                    />
                  </Field>
                  <Field label="Subtitle">
                    <Input
                      value={plan.info}
                      onChange={(e) => updatePlan(planIndex, { info: e.target.value })}
                    />
                  </Field>
                  {!isCastingServices && (
                    <Field label="Highlighted">
                      <label className="flex h-9 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={plan.highlighted ?? false}
                          onChange={(e) =>
                            updatePlan(planIndex, { highlighted: e.target.checked })
                          }
                        />
                        Popular plan
                      </label>
                    </Field>
                  )}
                  {isCastingServices && (
                    <div className="sm:col-span-2 lg:col-span-3">
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        This style uses the offering name, subtitle, feature lines, and image. Prices and buttons stay saved but are hidden.
                      </p>
                    </div>
                  )}
                  {!isPricingSlider && (
                    <div className="sm:col-span-2 lg:col-span-3">
                      <div
                        className={`grid gap-3 rounded-lg border p-3 ${
                          isCastingServices ? "" : "lg:grid-cols-2"
                        }`}
                      >
                        <Field label={isCastingServices ? "Offering image" : "Plan image / background"}>
                          <PhotoPicker
                            photos={photos}
                            value={plan.photoId ?? null}
                            onChange={(photoId) =>
                              updatePlan(planIndex, { photoId })
                            }
                            containerClassName="max-h-48"
                          />
                        </Field>
                        {!isCastingServices && (
                          <div className="space-y-2">
                            <Field label="Media panel image">
                              <PhotoPicker
                                photos={photos}
                                value={plan.mediaPhotoId ?? null}
                                onChange={(mediaPhotoId) =>
                                  updatePlan(planIndex, { mediaPhotoId })
                                }
                                containerClassName="max-h-36"
                              />
                            </Field>
                            <Field label="Media video link">
                              <Input
                                value={plan.mediaVideoUrl ?? ""}
                                placeholder="Optional video URL"
                                onChange={(e) =>
                                  updatePlan(planIndex, {
                                    mediaVideoUrl: e.target.value,
                                  })
                                }
                              />
                            </Field>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {!isCastingServices && (
                    <>
                      <Field label="Monthly price">
                        <Input
                          type="number"
                          step="0.01"
                          value={plan.monthlyPrice}
                          onChange={(e) =>
                            setPlanPrice(planIndex, "monthlyPrice", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Yearly price">
                        <Input
                          type="number"
                          step="0.01"
                          value={plan.yearlyPrice}
                          onChange={(e) =>
                            setPlanPrice(planIndex, "yearlyPrice", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Display price">
                        <Input
                          value={plan.priceLabel ?? ""}
                          placeholder="Optional, e.g. Contact us"
                          onChange={(e) =>
                            updatePlan(planIndex, { priceLabel: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Button label">
                        <Input
                          value={plan.ctaLabel}
                          onChange={(e) =>
                            updatePlan(planIndex, { ctaLabel: e.target.value })
                          }
                        />
                      </Field>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Button link">
                          <Input
                            value={plan.ctaHref}
                            onChange={(e) =>
                              updatePlan(planIndex, { ctaHref: e.target.value })
                            }
                          />
                        </Field>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-4 space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                      Features
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updatePlan(planIndex, {
                          features: [
                            ...plan.features,
                            makePricingFeature(`Feature ${plan.features.length + 1}`),
                          ],
                        })
                      }
                    >
                      <Plus className="h-4 w-4" />
                      Add feature
                    </Button>
                  </div>
                  {plan.features.map((feature, featureIndex) => (
                    <div
                      key={feature.id}
                      className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1fr_auto] lg:grid-cols-[1fr_1fr_auto_auto]"
                    >
                      <Field label="Feature">
                        <Input
                          value={feature.text}
                          onChange={(e) =>
                            updateFeature(planIndex, featureIndex, {
                              text: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Tooltip">
                        <Input
                          value={feature.tooltip ?? ""}
                          onChange={(e) =>
                            updateFeature(planIndex, featureIndex, {
                              tooltip: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Included">
                        <label className="flex h-9 items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={feature.included ?? true}
                            onChange={(e) =>
                              updateFeature(planIndex, featureIndex, {
                                included: e.target.checked,
                              })
                            }
                          />
                          Show check
                        </label>
                      </Field>
                      <div className="flex items-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={featureIndex === 0}
                          onClick={() =>
                            updatePlan(planIndex, {
                              features: swapAt(
                                plan.features,
                                featureIndex,
                                featureIndex - 1,
                              ),
                            })
                          }
                          aria-label="Move feature up"
                          className="h-9 w-9"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={featureIndex === plan.features.length - 1}
                          onClick={() =>
                            updatePlan(planIndex, {
                              features: swapAt(
                                plan.features,
                                featureIndex,
                                featureIndex + 1,
                              ),
                            })
                          }
                          aria-label="Move feature down"
                          className="h-9 w-9"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            updatePlan(planIndex, {
                              features: plan.features.filter(
                                (_, i) => i !== featureIndex,
                              ),
                            })
                          }
                          aria-label="Remove feature"
                          className="h-9 w-9"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => set({ plans: [...plans, makePricingPlan(plans.length)] })}
          >
            <Plus className="h-4 w-4" />
            Add {isCastingServices ? "offering" : "plan"}
          </Button>
        </div>
      );
    }
    case "shop":
      return (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Shop style">
              <Select
                value={block.style}
                onChange={(e) =>
                  set({
                    style: e.target.value as typeof block.style,
                    ...(e.target.value === "tora-coming-soon"
                      ? {
                          title:
                            block.title === "SHOP"
                              ? "Great things are on the horizon"
                              : block.title,
                          body:
                            block.body ===
                            "Browse prints, digital downloads, and curated bundles."
                              ? "Something big is brewing! Our store is in the works and will be launching soon!"
                              : block.body,
                        }
                      : {}),
                  })
                }
              >
                <option value="tora-grid">Tora product grid</option>
                <option value="tora-coming-soon">Tora coming soon</option>
              </Select>
            </Field>
            <Field label="Product source">
              <Select
                value={block.source}
                onChange={(e) => set({ source: e.target.value as typeof block.source })}
                disabled={block.style === "tora-coming-soon"}
              >
                <option value="all">All active products</option>
                <option value="featured">Featured products</option>
                <option value="category">Category label</option>
              </Select>
            </Field>
            <Field label="Category label">
              <Input
                value={block.category}
                onChange={(e) => set({ category: e.target.value })}
                disabled={block.source !== "category" || block.style === "tora-coming-soon"}
                placeholder="Sunset"
              />
            </Field>
            <Field label="Product limit">
              <Input
                type="number"
                min={1}
                max={48}
                value={block.limit}
                onChange={(e) =>
                  set({ limit: Math.min(48, Math.max(1, Number(e.target.value) || 1)) })
                }
                disabled={block.style === "tora-coming-soon"}
              />
            </Field>
            <Field label="Title">
              <Input value={block.title} onChange={(e) => set({ title: e.target.value })} />
            </Field>
            <Field label="Theme">
              <Select
                value={block.theme}
                onChange={(e) => set({ theme: e.target.value as typeof block.theme })}
              >
                <option value="auto">Auto</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </Select>
            </Field>
            <Field label="Background color">
              <Input
                type="color"
                value={block.backgroundColor}
                onChange={(e) => set({ backgroundColor: e.target.value })}
              />
            </Field>
            <Field label="Text color">
              <Input
                type="color"
                value={block.textColor}
                onChange={(e) => set({ textColor: e.target.value })}
              />
            </Field>
            <Field label="Accent color">
              <Input
                type="color"
                value={block.accentColor}
                onChange={(e) => set({ accentColor: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Body text">
            <Textarea
              value={block.body}
              onChange={(e) => set({ body: e.target.value })}
              rows={3}
            />
          </Field>
          {block.style === "tora-grid" && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["showSidebar", "Show sidebar"],
                ["showSearch", "Show search box"],
                ["showTagCloud", "Show tag cloud"],
                ["showSorting", "Show sorting control"],
                ["showSaleBadge", "Show sale badge"],
                ["showPrices", "Show prices"],
              ].map(([key, label]) => (
                <label key={key} className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(block[key as keyof typeof block])}
                    onChange={(e) => set({ [key]: e.target.checked } as Partial<LeafBlock>)}
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
        </div>
      );
    case "cta":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Headline"><Input value={block.headline} onChange={(e) => set({ headline: e.target.value })} /></Field>
          <Field label="Body"><Input value={block.body ?? ""} onChange={(e) => set({ body: e.target.value })} /></Field>
          <Field label="Button label"><Input value={block.buttonLabel} onChange={(e) => set({ buttonLabel: e.target.value })} /></Field>
          <Field label="Button link"><Input value={block.buttonHref} onChange={(e) => set({ buttonHref: e.target.value })} /></Field>
          <Field label="Button style">
            <Select value={block.buttonStyle ?? "pill"} onChange={(e) => set({ buttonStyle: e.target.value as typeof block.buttonStyle })}>
              <option value="solid">Solid</option>
              <option value="pill">Pill</option>
              <option value="outline">Outline</option>
              <option value="soft">Soft</option>
              <option value="link">Text link</option>
            </Select>
          </Field>
        </div>
      );
    case "customLink": {
      const items = block.items ?? [];
      const updateItem = (
        index: number,
        patch: Partial<(typeof items)[number]>,
      ) => {
        set({
          items: items.map((item, itemIndex) =>
            itemIndex === index ? { ...item, ...patch } : item,
          ),
        });
      };
      return (
        <div className="space-y-4">
          <SettingsGroup title="Layout">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Style">
                <Select
                  value={block.layout ?? "link-row"}
                  onChange={(e) => set({ layout: e.target.value as typeof block.layout })}
                >
                  <option value="link-row">Link row</option>
                  <option value="center-button">Centered button</option>
                </Select>
              </Field>
              <Field label="Background">
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={block.showBackground ?? false}
                    onChange={(e) => set({ showBackground: e.target.checked })}
                  />
                  Show background color
                </label>
              </Field>
              <Field label="Background color">
                <Input
                  type="color"
                  value={block.backgroundColor ?? "#252626"}
                  disabled={block.showBackground === false}
                  onChange={(e) => set({ backgroundColor: e.target.value })}
                />
              </Field>
              <Field label="Text color">
                <Input
                  type="color"
                  value={block.textColor ?? "#f8f3df"}
                  onChange={(e) => set({ textColor: e.target.value })}
                />
              </Field>
              <Field label="Accent color">
                <Input
                  type="color"
                  value={block.accentColor ?? "#d8c98d"}
                  onChange={(e) => set({ accentColor: e.target.value })}
                />
              </Field>
            </div>
          </SettingsGroup>

          {block.layout === "center-button" ? (
            <SettingsGroup title="Button">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Button label">
                  <Input
                    value={block.buttonLabel ?? ""}
                    onChange={(e) => set({ buttonLabel: e.target.value })}
                  />
                </Field>
                <Field label="Button link">
                  <Input
                    value={block.buttonHref ?? ""}
                    onChange={(e) => set({ buttonHref: e.target.value })}
                  />
                </Field>
              </div>
            </SettingsGroup>
          ) : (
            <SettingsGroup title="Links">
              <div className="mb-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => set({ items: [...items, makeCustomLinkItem(items.length)] })}
                >
                  <Plus className="h-4 w-4" />
                  Add link
                </Button>
              </div>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id} className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 text-sm font-medium">
                        {item.title || `Link ${index + 1}`}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === 0}
                        onClick={() => set({ items: swapAt(items, index, index - 1) })}
                        aria-label="Move link up"
                        className="h-8 w-8"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === items.length - 1}
                        onClick={() => set({ items: swapAt(items, index, index + 1) })}
                        aria-label="Move link down"
                        className="h-8 w-8"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => set({ items: items.filter((_, itemIndex) => itemIndex !== index) })}
                        aria-label="Remove link"
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Field label="Title">
                        <Input
                          value={item.title ?? ""}
                          onChange={(e) => updateItem(index, { title: e.target.value })}
                        />
                      </Field>
                      <Field label="Subtitle">
                        <Input
                          value={item.subtitle ?? ""}
                          onChange={(e) => updateItem(index, { subtitle: e.target.value })}
                        />
                      </Field>
                      <Field label="Link">
                        <Input
                          value={item.href ?? ""}
                          onChange={(e) => updateItem(index, { href: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </SettingsGroup>
          )}
        </div>
      );
    }
    case "contactForm": {
      const isCombinedContactsReference = block.style === "tora-contacts-reference";
      const isContactInfoReference = block.style === "tora-contact-info";
      const isImagesFormReference = block.style === "tora-images-form";
      const usesContactsReference =
        isCombinedContactsReference || isContactInfoReference || isImagesFormReference;
      const showContactInfoSettings = isCombinedContactsReference || isContactInfoReference;
      const showImagesFormSettings = isCombinedContactsReference || isImagesFormReference;
      const contactInfoItems = block.contactInfoItems ?? [];
      const contactSocialLinks = block.contactSocialLinks ?? [];
      const contactImagePhotoIds = block.contactImagePhotoIds ?? [];
      const updateInfoItem = (
        index: number,
        patch: Partial<(typeof contactInfoItems)[number]>,
      ) => {
        set({
          contactInfoItems: contactInfoItems.map((item, itemIndex) =>
            itemIndex === index ? { ...item, ...patch } : item,
          ),
        });
      };
      const updateSocialLink = (
        index: number,
        patch: Partial<(typeof contactSocialLinks)[number]>,
      ) => {
        set({
          contactSocialLinks: contactSocialLinks.map((item, itemIndex) =>
            itemIndex === index ? { ...item, ...patch } : item,
          ),
        });
      };
      return (
        <div className="space-y-3">
          <SettingsGroup title="Layout">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Form style">
                <Select
                value={block.style}
                onChange={(e) => {
                  const style = e.target.value as typeof block.style;
                  const nextIsCombinedContactsReference = style === "tora-contacts-reference";
                  const nextIsContactInfoReference = style === "tora-contact-info";
                  const nextIsImagesFormReference = style === "tora-images-form";
                  const nextUsesContactsReference =
                    nextIsCombinedContactsReference ||
                    nextIsContactInfoReference ||
                    nextIsImagesFormReference;
                  const nextUsesContactInfo =
                    nextIsCombinedContactsReference || nextIsContactInfoReference;
                  const nextUsesImagesForm =
                    nextIsCombinedContactsReference || nextIsImagesFormReference;
                  set({
                    style,
                    ...(style === "tora-contact"
                        ? {
                            eyebrow: block.eyebrow === "Contact" ? "" : block.eyebrow,
                            heading:
                              block.heading === "Get in touch"
                                ? "GET IN TOUCH"
                                : block.heading,
                            body:
                              block.body ===
                              "Tell me about your session, event, or print order and I'll be in touch soon."
                                ? ""
                                : block.body,
                            submitLabel:
                              block.submitLabel === "Send message"
                                ? "SUBMIT NOW"
                                : block.submitLabel,
                            align: "center",
                          }
                        : {}),
                      ...(nextUsesContactsReference
                        ? {
                            heading:
                              block.heading === "Get in touch"
                                ? "CONTACT INFO"
                                : block.heading,
                            ...(nextUsesImagesForm
                              ? {
                                  submitLabel:
                                    block.submitLabel === "Send message"
                                      ? "SUBMIT NOW"
                                      : block.submitLabel,
                                }
                              : {}),
                            align: "center",
                            ...(nextIsCombinedContactsReference
                              ? {
                                  contactHeroTitle: block.contactHeroTitle || "CONTACTS",
                                  contactHeroOverlayOpacity: block.contactHeroOverlayOpacity ?? 0.45,
                                }
                              : {}),
                            ...(nextUsesContactInfo
                              ? {
                                  contactInfoEyebrow: block.contactInfoEyebrow || "CONTACT",
                                  contactInfoHeading: block.contactInfoHeading || "CONTACT INFO",
                                  contactInfoIntro:
                                    block.contactInfoIntro ||
                                    "IF YOU NEED TO MESSAGE US, PLEASE FILL OUT THE FORM BELLOW",
                                  contactInfoItems:
                                    contactInfoItems.length > 0
                                      ? contactInfoItems
                                      : [makeContactInfoItem(0), makeContactInfoItem(1)],
                                }
                              : {}),
                            ...(nextUsesImagesForm
                              ? {
                                  contactImageEyebrow: block.contactImageEyebrow || "CONTACT",
                                  contactImageHeading:
                                    block.contactImageHeading || "IMAGES WITH FORM",
                                  contactSocialLinks:
                                    contactSocialLinks.length > 0
                                      ? contactSocialLinks
                                      : [
                                          makeContactSocialLink(0),
                                          makeContactSocialLink(1),
                                          makeContactSocialLink(2),
                                        ],
                                  contactImagePhotoIds,
                                  contactSideCaption:
                                    block.contactSideCaption ||
                                    "Designed by © REFLECTOR Studio. All Right Reserved 2019",
                                }
                              : {}),
                          }
                        : {}),
                  });
                  }}
                >
                  <option value="stacked">Stacked intro</option>
                  <option value="split">Split intro + form</option>
                  <option value="card">Card form</option>
                  <option value="minimal">Minimal</option>
                  <option value="tora-contact">Tora contact</option>
                  <option value="tora-contact-info">Tora contact info</option>
                  <option value="tora-images-form">Tora images with form</option>
                  {isCombinedContactsReference && (
                    <option value="tora-contacts-reference">
                      Tora contacts reference (combined)
                    </option>
                  )}
                </Select>
              </Field>
              {!usesContactsReference && (
                <AlignField value={block.align} onChange={(align) => set({ align })} />
              )}
              {!isContactInfoReference && (
                <Field label="Submit button">
                  <Input value={block.submitLabel} onChange={(e) => set({ submitLabel: e.target.value })} />
                </Field>
              )}
            </div>
          </SettingsGroup>

          {usesContactsReference ? (
            <>
              {isCombinedContactsReference && (
                <SettingsGroup title="Hero">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Hero title">
                      <Input
                        value={block.contactHeroTitle ?? ""}
                        onChange={(e) => set({ contactHeroTitle: e.target.value })}
                      />
                    </Field>
                    <Field label="Photo dim">
                      <Input
                        type="number"
                        min={0}
                        max={0.85}
                        step={0.05}
                        value={block.contactHeroOverlayOpacity ?? 0.45}
                        onChange={(e) => set({ contactHeroOverlayOpacity: Number(e.target.value) })}
                      />
                    </Field>
                  </div>
                  <Field label="Hero photo">
                    <PhotoPicker
                      photos={photos}
                      value={block.contactHeroPhotoId ?? null}
                      onChange={(photoId) => set({ contactHeroPhotoId: photoId })}
                    />
                  </Field>
                </SettingsGroup>
              )}

              {showContactInfoSettings && (
                <SettingsGroup title="Contact info">
                  {isCombinedContactsReference && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Small label">
                        <Input
                          value={block.contactInfoEyebrow ?? ""}
                          onChange={(e) => set({ contactInfoEyebrow: e.target.value })}
                        />
                      </Field>
                      <Field label="Heading">
                        <Input
                          value={block.contactInfoHeading ?? ""}
                          onChange={(e) => set({ contactInfoHeading: e.target.value })}
                        />
                      </Field>
                    </div>
                  )}
                  <Field label="Large intro">
                    <Textarea
                      rows={3}
                      value={block.contactInfoIntro ?? ""}
                      onChange={(e) => set({ contactInfoIntro: e.target.value })}
                    />
                  </Field>
                  <div className="space-y-2">
                    {contactInfoItems.map((item, index) => (
                      <div key={item.id} className="space-y-2 rounded-md border p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                            Contact item {index + 1}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={index === 0}
                              onClick={() => set({ contactInfoItems: swapAt(contactInfoItems, index, index - 1) })}
                              aria-label="Move contact item up"
                              className="h-8 w-8"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={index === contactInfoItems.length - 1}
                              onClick={() => set({ contactInfoItems: swapAt(contactInfoItems, index, index + 1) })}
                              aria-label="Move contact item down"
                              className="h-8 w-8"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => set({ contactInfoItems: contactInfoItems.filter((_, itemIndex) => itemIndex !== index) })}
                              aria-label="Remove contact item"
                              className="h-8 w-8"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Field label="Title">
                            <Input
                              value={item.title ?? ""}
                              onChange={(e) => updateInfoItem(index, { title: e.target.value })}
                            />
                          </Field>
                          <Field label="Phone">
                            <Input
                              value={item.phone ?? ""}
                              onChange={(e) => updateInfoItem(index, { phone: e.target.value })}
                            />
                          </Field>
                        </div>
                        <Field label="Address">
                          <Input
                            value={item.address ?? ""}
                            onChange={(e) => updateInfoItem(index, { address: e.target.value })}
                          />
                        </Field>
                        <Field label="Phone link">
                          <Input
                            value={item.href ?? ""}
                            onChange={(e) => updateInfoItem(index, { href: e.target.value })}
                            placeholder="tel:+13122299000"
                          />
                        </Field>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => set({ contactInfoItems: [...contactInfoItems, makeContactInfoItem(contactInfoItems.length)] })}
                    >
                      Add contact item
                    </Button>
                  </div>
                </SettingsGroup>
              )}

              {showImagesFormSettings && (
                <>
                  <SettingsGroup title="Images with form">
                    {isCombinedContactsReference && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Field label="Small label">
                          <Input
                            value={block.contactImageEyebrow ?? ""}
                            onChange={(e) => set({ contactImageEyebrow: e.target.value })}
                          />
                        </Field>
                        <Field label="Heading">
                          <Input
                            value={block.contactImageHeading ?? ""}
                            onChange={(e) => set({ contactImageHeading: e.target.value })}
                          />
                        </Field>
                      </div>
                    )}
                    <Field label="Mosaic photos">
                      <PhotoPicker
                        photos={photos}
                        selectedIds={contactImagePhotoIds}
                        onToggle={(photoId) =>
                          set({
                            contactImagePhotoIds: contactImagePhotoIds.includes(photoId)
                              ? contactImagePhotoIds.filter((id) => id !== photoId)
                              : [...contactImagePhotoIds, photoId],
                          })
                        }
                      />
                    </Field>
                    <PhotoOrderList
                      photos={photos}
                      ids={contactImagePhotoIds}
                      onChange={(ids) => set({ contactImagePhotoIds: ids })}
                    />
                    <Field label="Side caption">
                      <Input
                        value={block.contactSideCaption ?? ""}
                        onChange={(e) => set({ contactSideCaption: e.target.value })}
                      />
                    </Field>
                  </SettingsGroup>

                  <SettingsGroup title="Social links">
                    <div className="space-y-2">
                      {contactSocialLinks.map((item, index) => (
                        <div key={item.id} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1fr_auto]">
                          <Field label="Label">
                            <Input
                              value={item.label ?? ""}
                              onChange={(e) => updateSocialLink(index, { label: e.target.value })}
                            />
                          </Field>
                          <Field label="Link">
                            <Input
                              value={item.href ?? ""}
                              onChange={(e) => updateSocialLink(index, { href: e.target.value })}
                            />
                          </Field>
                          <div className="flex items-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={index === 0}
                              onClick={() => set({ contactSocialLinks: swapAt(contactSocialLinks, index, index - 1) })}
                              aria-label="Move social link up"
                              className="h-8 w-8"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={index === contactSocialLinks.length - 1}
                              onClick={() => set({ contactSocialLinks: swapAt(contactSocialLinks, index, index + 1) })}
                              aria-label="Move social link down"
                              className="h-8 w-8"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => set({ contactSocialLinks: contactSocialLinks.filter((_, itemIndex) => itemIndex !== index) })}
                              aria-label="Remove social link"
                              className="h-8 w-8"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => set({ contactSocialLinks: [...contactSocialLinks, makeContactSocialLink(contactSocialLinks.length)] })}
                      >
                        Add social link
                      </Button>
                    </div>
                  </SettingsGroup>
                </>
              )}
            </>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Top label">
                  <Input value={block.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} />
                </Field>
                <Field label="Heading">
                  <Input value={block.heading} onChange={(e) => set({ heading: e.target.value })} />
                </Field>
              </div>
              <Field label="Intro text">
                <Textarea rows={3} value={block.body} onChange={(e) => set({ body: e.target.value })} />
              </Field>
            </>
          )}
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Messages submit to the existing contact inbox. Manage received messages in{" "}
            <Link href="/admin/contact" className="underline underline-offset-2">Inbox</Link>.
          </p>
        </div>
      );
    }
    case "image":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Photo">
            <PhotoPicker photos={photos} value={block.photoId ?? null} onChange={(pid) => set({ photoId: pid })} />
          </Field>
          <Field label="Width">
            <Select value={block.width} onChange={(e) => set({ width: e.target.value as typeof block.width })}>
              <option value="normal">Normal</option><option value="wide">Wide</option><option value="full">Full</option>
            </Select>
          </Field>
          <Field label="Caption"><Input value={block.caption ?? ""} onChange={(e) => set({ caption: e.target.value })} /></Field>
        </div>
      );
    case "portfolioList": {
      const items = block.items ?? [];
      const updateItem = (
        index: number,
        patch: Partial<(typeof items)[number]>,
      ) => {
        set({
          items: items.map((item, itemIndex) =>
            itemIndex === index ? { ...item, ...patch } : item,
          ),
        });
      };
      const style = block.style ?? "modern";
      const supportsHoverPhoto = style === "distortion";
      const isToraModelsMasonry = style === "tora-models-masonry";
      const isToraWeddingStories = style === "tora-wedding-stories";
      const isToraFullShowcaseSlider = style === "tora-full-showcase-slider";
      return (
        <div className="space-y-4">
          <SettingsGroup title="Layout">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Style">
                <Select
                  value={style}
                  onChange={(e) => {
                    const next = e.target.value as typeof block.style;
                    set({
                      style: next,
                      title:
                        next === "tora-progress-slider"
                          ? "FEATURED GALLERIES"
                          : next === "tora-parallax-showcase"
                            ? "PARALLAX SHOWCASE"
                          : next === "tora-full-showcase-slider"
                            ? ""
                          : next === "tora-models-masonry"
                            ? "OUR MODELS"
                          : next === "tora-wedding-stories"
                            ? ""
                          : next === "category-cards"
                          ? "CATEGORY LIST"
                          : next === "distortion"
                            ? "DISTORTION STYLE"
                            : next === "animated-masonry"
                              ? "MASONRY STYLE"
                              : next === "mix-masonry"
                                ? "MIX MASONRY"
                        : "MODERN",
                      eyebrow:
                        next === "tora-models-masonry"
                          ? "CHECK OUT"
                          : next === "tora-full-showcase-slider"
                            ? ""
                          : next === "tora-wedding-stories"
                            ? ""
                            : block.eyebrow,
                      backgroundColor:
                        next === "tora-models-masonry" || next === "tora-wedding-stories"
                          || next === "tora-full-showcase-slider"
                          ? "#252626"
                          : block.backgroundColor,
                      textColor:
                        next === "tora-models-masonry" || next === "tora-wedding-stories"
                          || next === "tora-full-showcase-slider"
                          ? "#f8f3df"
                          : block.textColor,
                      accentColor:
                        next === "tora-models-masonry" || next === "tora-wedding-stories"
                          || next === "tora-full-showcase-slider"
                          ? "#d8c98d"
                          : block.accentColor,
                      body:
                        next === "tora-models-masonry" || next === "tora-wedding-stories"
                          || next === "tora-full-showcase-slider"
                          ? ""
                          : block.body,
                    });
                  }}
                >
                  <option value="modern">Modern list</option>
                  <option value="category-cards">Category cards</option>
                  <option value="distortion">Distortion feature</option>
                  <option value="animated-masonry">Animated masonry</option>
                  <option value="mix-masonry">Mix masonry</option>
                  <option value="tora-progress-slider">Tora progress slider</option>
                  <option value="tora-parallax-showcase">Tora parallax showcase</option>
                  <option value="tora-full-showcase-slider">Tora full showcase slider</option>
                  <option value="tora-models-masonry">Tora models masonry</option>
                  <option value="tora-wedding-stories">Tora wedding stories</option>
                </Select>
              </Field>
              {!isToraFullShowcaseSlider && (
                <>
                  <Field label="Top label">
                    <Input
                      value={block.eyebrow ?? ""}
                      onChange={(e) => set({ eyebrow: e.target.value })}
                    />
                  </Field>
                  <Field label="Title">
                    <Input
                      value={block.title ?? ""}
                      onChange={(e) => set({ title: e.target.value })}
                    />
                  </Field>
                </>
              )}
              <Field label="Background">
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={block.showBackground ?? true}
                    onChange={(e) => set({ showBackground: e.target.checked })}
                  />
                  Show dark panel
                </label>
              </Field>
              <Field label="Background color">
                <Input
                  type="color"
                  value={block.backgroundColor ?? "#242625"}
                  onChange={(e) => set({ backgroundColor: e.target.value })}
                  disabled={block.showBackground === false}
                />
              </Field>
              <Field label="Text color">
                <Input
                  type="color"
                  value={block.textColor ?? "#f8f3df"}
                  onChange={(e) => set({ textColor: e.target.value })}
                />
              </Field>
              <Field label="Accent color">
                <Input
                  type="color"
                  value={block.accentColor ?? "#d8c98d"}
                  onChange={(e) => set({ accentColor: e.target.value })}
                />
              </Field>
            </div>
            {!isToraModelsMasonry && !isToraWeddingStories && !isToraFullShowcaseSlider && (
              <Field label="Intro text">
                <Textarea
                  rows={2}
                  value={block.body ?? ""}
                  onChange={(e) => set({ body: e.target.value })}
                />
              </Field>
            )}
          </SettingsGroup>

          <SettingsGroup title="Portfolio items">
            <div className="mb-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => set({ items: [...items, makePortfolioListItem(items.length)] })}
              >
                <Plus className="h-4 w-4" />
                Add item
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  set({
                    items: [
                      ...items,
                      ...Array.from({ length: 3 }, (_, addIndex) =>
                        makePortfolioListItem(items.length + addIndex),
                      ),
                    ],
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Add 3 items
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={item.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm font-medium">
                      {item.title || `Portfolio item ${index + 1}`}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={() => set({ items: swapAt(items, index, index - 1) })}
                      aria-label="Move item up"
                      className="h-8 w-8"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === items.length - 1}
                      onClick={() => set({ items: swapAt(items, index, index + 1) })}
                      aria-label="Move item down"
                      className="h-8 w-8"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        set({ items: items.filter((_, itemIndex) => itemIndex !== index) })
                      }
                      aria-label="Remove item"
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className={supportsHoverPhoto ? "grid gap-3 lg:grid-cols-2" : "grid gap-3"}>
                    <Field label="Cover photo">
                      <PhotoPicker
                        photos={photos}
                        value={item.photoId ?? null}
                        onChange={(photoId) => updateItem(index, { photoId })}
                        containerClassName="max-h-52"
                      />
                    </Field>
                    {supportsHoverPhoto && (
                      <Field label="Hover photo">
                        <PhotoPicker
                          photos={photos}
                          value={item.hoverPhotoId ?? null}
                          onChange={(photoId) => updateItem(index, { hoverPhotoId: photoId })}
                          containerClassName="max-h-52"
                        />
                      </Field>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Title">
                      <Input
                        value={item.title ?? ""}
                        onChange={(e) => updateItem(index, { title: e.target.value })}
                      />
                    </Field>
                    {!isToraModelsMasonry && (
                      <Field label="Category">
                        <Input
                          value={item.category ?? ""}
                          onChange={(e) => updateItem(index, { category: e.target.value })}
                        />
                      </Field>
                    )}
                    {!isToraModelsMasonry && (
                      <div className="sm:col-span-2">
                        <Field label="Description">
                          <Textarea
                            rows={2}
                            value={item.description ?? ""}
                            onChange={(e) => updateItem(index, { description: e.target.value })}
                          />
                        </Field>
                      </div>
                    )}
                    {!isToraModelsMasonry && (
                      <Field label="Link label">
                        <Input
                          value={item.linkLabel ?? ""}
                          onChange={(e) => updateItem(index, { linkLabel: e.target.value })}
                        />
                      </Field>
                    )}
                    <Field label="Link URL">
                      <Input
                        value={item.linkHref ?? ""}
                        onChange={(e) => updateItem(index, { linkHref: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="rounded-md border border-dashed p-4 text-sm text-[hsl(var(--muted-foreground))]">
                  Add portfolio items to render this block.
                </p>
              )}
            </div>
          </SettingsGroup>
        </div>
      );
    }
    case "about": {
      const layout = block.layout ?? "simple";
      const pressLinks = block.pressLinks ?? [];
      const awardLinks = block.awardLinks ?? [];
      const updateLink = (
        key: "pressLinks" | "awardLinks",
        index: number,
        patch: Partial<(typeof pressLinks)[number]>,
      ) => {
        const links = key === "pressLinks" ? pressLinks : awardLinks;
        set({
          [key]: links.map((link, i) =>
            i === index ? { ...link, ...patch } : link,
          ),
        } as Partial<LeafBlock>);
      };
      const removeLink = (key: "pressLinks" | "awardLinks", index: number) => {
        const links = key === "pressLinks" ? pressLinks : awardLinks;
        set({ [key]: links.filter((_, i) => i !== index) } as Partial<LeafBlock>);
      };
      const addLink = (key: "pressLinks" | "awardLinks") => {
        const links = key === "pressLinks" ? pressLinks : awardLinks;
        set({ [key]: [...links, makeAboutLink("Link", "#")] } as Partial<LeafBlock>);
      };
      const renderLinks = (key: "pressLinks" | "awardLinks", links: typeof pressLinks) => (
        <div className="space-y-2">
          {links.map((link, index) => (
            <div key={link.id} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                value={link.label}
                onChange={(e) => updateLink(key, index, { label: e.target.value })}
                placeholder="Label"
              />
              <Input
                value={link.href}
                onChange={(e) => updateLink(key, index, { href: e.target.value })}
                placeholder="/about or https://..."
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLink(key, index)}
                aria-label="Remove link"
                className="h-9 w-9"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => addLink(key)}
            className="w-full justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add link
          </Button>
        </div>
      );

      return (
        <div className="space-y-3">
          <SettingsGroup title="Layout">
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Style">
                <Select
                  value={layout}
                  onChange={(e) => {
                    const next = e.target.value as typeof block.layout;
                    const isToraAboutMe = next === "tora-about-me";
                    set({
                      layout: next,
                      sectionTitle:
                        next === "modern"
                          ? "MODERN"
                          : next === "classic"
                            ? "CLASSIC"
                            : isToraAboutMe
                              ? ""
                            : next === "tora-casting"
                              ? ""
                              : "SIMPLE",
                      sectionEyebrow: isToraAboutMe ? "" : block.sectionEyebrow,
                      headline:
                        next === "modern"
                          ? "ABOUT ME"
                          : next === "classic"
                            ? "GET TO KNOW ME BETTER"
                            : isToraAboutMe
                              ? "ABOUT ME"
                            : next === "tora-casting"
                              ? "CASTING"
                              : "HI, I'M REFLECTOR",
                      eyebrow: next === "classic" ? "GET TO KNOW ME" : "",
                      body: isToraAboutMe
                        ? "We are fine-art, campaign & portrait film photographers from Oregon, with a special love for natural light, medium format film cameras & redheads with freckles. I am interested in the details about your wedding, your ceremony & reception venues, your vision, your dress, your colours and anything else you would like to share with me."
                        : block.body,
                      ctaLabel:
                        next === "classic"
                          ? "CONTACT US"
                          : isToraAboutMe
                            ? ""
                          : next === "tora-casting"
                            ? ""
                            : "learn more",
                      ctaHref: isToraAboutMe ? "" : block.ctaHref,
                      facebookUrl: isToraAboutMe && !block.facebookUrl ? "#" : block.facebookUrl,
                      twitterUrl: isToraAboutMe && !block.twitterUrl ? "#" : block.twitterUrl,
                      instagramUrl: isToraAboutMe && !block.instagramUrl ? "#" : block.instagramUrl,
                      showContactForm: isToraAboutMe ? true : block.showContactForm,
                      submitLabel: isToraAboutMe ? "Send" : block.submitLabel,
                    });
                  }}
                >
                  <option value="simple">Simple</option>
                  <option value="modern">Modern</option>
                  <option value="classic">Classic</option>
                  <option value="tora-casting">Tora casting intro</option>
                  <option value="tora-about-me">Tora about me</option>
                </Select>
              </Field>
              {layout !== "tora-casting" && layout !== "tora-about-me" && (
                <>
                  <Field label="Top label">
                    <Input
                      value={block.sectionEyebrow ?? ""}
                      onChange={(e) => set({ sectionEyebrow: e.target.value })}
                    />
                  </Field>
                  <Field label="Top title">
                    <Input
                      value={block.sectionTitle ?? ""}
                      onChange={(e) => set({ sectionTitle: e.target.value })}
                    />
                  </Field>
                </>
              )}
            </div>
          </SettingsGroup>

          <SettingsGroup title="Text">
            <div className="grid gap-2 sm:grid-cols-2">
              {layout !== "tora-casting" && layout !== "tora-about-me" && (
                <Field label="Small label">
                  <Input
                    value={block.eyebrow ?? ""}
                    onChange={(e) => set({ eyebrow: e.target.value })}
                    placeholder={layout === "classic" ? "GET TO KNOW ME" : ""}
                  />
                </Field>
              )}
              <Field label="Headline">
                <Input
                  value={block.headline ?? ""}
                  onChange={(e) => set({ headline: e.target.value })}
                />
              </Field>
            </div>
            {layout === "classic" && (
              <Field label="Quote">
                <Input
                  value={block.quote ?? ""}
                  onChange={(e) => set({ quote: e.target.value })}
                />
              </Field>
            )}
            <Field label="Body text">
              <Textarea
                rows={5}
                value={block.body ?? ""}
                onChange={(e) => set({ body: e.target.value })}
              />
            </Field>
            {layout !== "tora-casting" && layout !== "tora-about-me" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Button label">
                  <Input
                    value={block.ctaLabel ?? ""}
                    onChange={(e) => set({ ctaLabel: e.target.value })}
                  />
                </Field>
                <Field label="Button link">
                  <Input
                    value={block.ctaHref ?? ""}
                    onChange={(e) => set({ ctaHref: e.target.value })}
                  />
                </Field>
              </div>
            )}
          </SettingsGroup>

          <SettingsGroup title="Photos">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={layout === "classic" || layout === "tora-casting" ? "Photo 1" : "Portrait photo"}>
                <PhotoPicker
                  photos={photos}
                  value={block.primaryPhotoId ?? null}
                  onChange={(photoId) => set({ primaryPhotoId: photoId })}
                  containerClassName="max-h-64"
                />
              </Field>
              {(layout === "classic" || layout === "tora-casting") && (
                <>
                  <Field label="Photo 2">
                    <PhotoPicker
                      photos={photos}
                      value={block.secondaryPhotoId ?? null}
                      onChange={(photoId) => set({ secondaryPhotoId: photoId })}
                      containerClassName="max-h-64"
                    />
                  </Field>
                  <Field label="Photo 3">
                    <PhotoPicker
                      photos={photos}
                      value={block.tertiaryPhotoId ?? null}
                      onChange={(photoId) => set({ tertiaryPhotoId: photoId })}
                      containerClassName="max-h-64"
                    />
                  </Field>
                </>
              )}
            </div>
          </SettingsGroup>

          {(layout === "modern" || layout === "tora-about-me") && (
            <SettingsGroup title={layout === "tora-about-me" ? "About me details" : "Modern details"}>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Contact title">
                  <Input
                    value={block.contactTitle ?? ""}
                    onChange={(e) => set({ contactTitle: e.target.value })}
                  />
                </Field>
                <Field label="Address">
                  <Input
                    value={block.address ?? ""}
                    onChange={(e) => set({ address: e.target.value })}
                  />
                </Field>
                <Field label="Phone label">
                  <Input
                    value={block.phoneLabel ?? ""}
                    onChange={(e) => set({ phoneLabel: e.target.value })}
                  />
                </Field>
                <Field label="Phone number">
                  <Input
                    value={block.phoneNumber ?? ""}
                    onChange={(e) => set({ phoneNumber: e.target.value })}
                  />
                </Field>
                <Field label="Facebook URL">
                  <Input
                    value={block.facebookUrl ?? ""}
                    onChange={(e) => set({ facebookUrl: e.target.value })}
                  />
                </Field>
                <Field label="X/Twitter URL">
                  <Input
                    value={block.twitterUrl ?? ""}
                    onChange={(e) => set({ twitterUrl: e.target.value })}
                  />
                </Field>
                <Field label="Instagram URL">
                  <Input
                    value={block.instagramUrl ?? ""}
                    onChange={(e) => set({ instagramUrl: e.target.value })}
                  />
                </Field>
                <Field label="Contact form">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.showContactForm ?? true}
                      onChange={(e) => set({ showContactForm: e.target.checked })}
                    />
                    Show embedded form
                  </label>
                </Field>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Press title">
                  <Input
                    value={block.pressTitle ?? ""}
                    onChange={(e) => set({ pressTitle: e.target.value })}
                  />
                </Field>
                <Field label="Awards title">
                  <Input
                    value={block.awardsTitle ?? ""}
                    onChange={(e) => set({ awardsTitle: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Press links">{renderLinks("pressLinks", pressLinks)}</Field>
              <Field label="Award links">{renderLinks("awardLinks", awardLinks)}</Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Collaborators title">
                  <Input
                    value={block.collaboratorsTitle ?? ""}
                    onChange={(e) => set({ collaboratorsTitle: e.target.value })}
                  />
                </Field>
                <Field label="Form title">
                  <Input
                    value={block.contactFormTitle ?? ""}
                    onChange={(e) => set({ contactFormTitle: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Collaborators text">
                <Textarea
                  rows={3}
                  value={block.collaboratorsText ?? ""}
                  onChange={(e) => set({ collaboratorsText: e.target.value })}
                />
              </Field>
              <Field label="Submit label">
                <Input
                  value={block.submitLabel ?? ""}
                  onChange={(e) => set({ submitLabel: e.target.value })}
                />
              </Field>
            </SettingsGroup>
          )}
        </div>
      );
    }
    case "imageComparison": {
      const isVerticalComparison = block.comparisonOrientation === "vertical";
      return (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Title">
              <Input
                value={block.title ?? ""}
                onChange={(e) => set({ title: e.target.value })}
              />
            </Field>
            <Field label="Subtitle">
              <Input
                value={block.subtitle ?? ""}
                onChange={(e) => set({ subtitle: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={isVerticalComparison ? "Top image" : "Left image"}>
              <PhotoPicker
                photos={photos}
                value={block.leftPhotoId ?? null}
                onChange={(photoId) => set({ leftPhotoId: photoId })}
                containerClassName="max-h-64"
              />
            </Field>
            <Field label={isVerticalComparison ? "Bottom image" : "Right image"}>
              <PhotoPicker
                photos={photos}
                value={block.rightPhotoId ?? null}
                onChange={(photoId) => set({ rightPhotoId: photoId })}
                containerClassName="max-h-64"
              />
            </Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Orientation">
              <Select
                value={block.comparisonOrientation ?? "horizontal"}
                onChange={(e) =>
                  set({
                    comparisonOrientation: e.target.value as typeof block.comparisonOrientation,
                  })
                }
              >
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </Select>
            </Field>
            <Field label={isVerticalComparison ? "Top label" : "Left label"}>
              <Input
                value={block.leftLabel ?? ""}
                onChange={(e) => set({ leftLabel: e.target.value })}
              />
            </Field>
            <Field label={isVerticalComparison ? "Bottom label" : "Right label"}>
              <Input
                value={block.rightLabel ?? ""}
                onChange={(e) => set({ rightLabel: e.target.value })}
              />
            </Field>
            <Field label="Starting position">
              <Input
                type="number"
                min={5}
                max={95}
                step={1}
                value={block.initialPosition ?? 50}
                onChange={(e) =>
                  set({
                    initialPosition: Math.min(
                      95,
                      Math.max(5, Number(e.target.value) || 50),
                    ),
                  })
                }
              />
            </Field>
            <Field label="Aspect ratio">
              <Select
                value={
                  block.aspectRatio === "portrait"
                    ? "4-5"
                    : (block.aspectRatio ?? "16-9")
                }
                onChange={(e) =>
                  set({ aspectRatio: e.target.value as typeof block.aspectRatio })
                }
              >
                <option value="16-9">16:9 wide</option>
                <option value="3-2">3:2 landscape</option>
                <option value="4-3">4:3 landscape</option>
                <option value="square">1:1 square</option>
                <option value="4-5">4:5 portrait</option>
                <option value="3-4">3:4 portrait</option>
                <option value="2-3">2:3 portrait</option>
                <option value="9-16">9:16 vertical</option>
              </Select>
            </Field>
            <Field label="Width">
              <Select
                value={block.width ?? "wide"}
                onChange={(e) => set({ width: e.target.value as typeof block.width })}
              >
                <option value="normal">Normal</option>
                <option value="wide">Wide</option>
                <option value="full">Full</option>
              </Select>
            </Field>
            <Field label="Handle color">
              <Input
                type="color"
                value={block.handleColor ?? "#ffffff"}
                onChange={(e) => set({ handleColor: e.target.value })}
              />
            </Field>
            <Field label="Background color">
              <Input
                type="color"
                value={block.backgroundColor ?? "#f4f4f5"}
                onChange={(e) => set({ backgroundColor: e.target.value })}
                disabled={block.showcaseBackground === false}
              />
            </Field>
            <Field label="Corners">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={block.rounded ?? true}
                  onChange={(e) => set({ rounded: e.target.checked })}
                />
                Rounded frame
              </label>
            </Field>
            <Field label="Showcase background">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={block.showcaseBackground ?? true}
                  onChange={(e) => set({ showcaseBackground: e.target.checked })}
                />
                Show background panel
              </label>
            </Field>
          </div>
        </div>
      );
    }
    case "featureCarousel": {
      const selectedPhotos = block.photoIds
        .map((photoId) => photos.find((photo) => photo.id === photoId))
        .filter((photo): photo is PhotoOption => Boolean(photo));
      const togglePhoto = (photoId: string) =>
        set({
          photoIds: block.photoIds.includes(photoId)
            ? block.photoIds.filter((id) => id !== photoId)
            : [...block.photoIds, photoId],
        });
      return (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <Field label="Headline">
                <Input
                  value={block.headline}
                  onChange={(e) => set({ headline: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Highlight text">
              <Input
                value={block.highlightText}
                onChange={(e) => set({ highlightText: e.target.value })}
              />
            </Field>
            <Field label="Image corners">
              <Select
                value={block.imageRadius ?? "xl"}
                onChange={(e) =>
                  set({ imageRadius: e.target.value as typeof block.imageRadius })
                }
              >
                <option value="lg">Soft</option>
                <option value="xl">Rounded</option>
                <option value="full">Pill</option>
              </Select>
            </Field>
            <Field label="Desktop visible images">
              <Select
                value={block.desktopVisibleCount ?? "3"}
                onChange={(e) =>
                  set({
                    desktopVisibleCount: e.target
                      .value as typeof block.desktopVisibleCount,
                  })
                }
              >
                <option value="3">3 images</option>
                <option value="5">5 images</option>
                <option value="7">7 images</option>
              </Select>
            </Field>
            <Field label="Gradient from">
              <Input
                type="color"
                value={block.highlightFrom ?? "#3b82f6"}
                onChange={(e) => set({ highlightFrom: e.target.value })}
              />
            </Field>
            <Field label="Gradient to">
              <Input
                type="color"
                value={block.highlightTo ?? "#a855f7"}
                onChange={(e) => set({ highlightTo: e.target.value })}
              />
            </Field>
            <Field label="Autoplay">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={block.autoplay ?? false}
                  onChange={(e) => set({ autoplay: e.target.checked })}
                />
                Auto advance
              </label>
            </Field>
            <Field label="Autoplay speed">
              <Input
                type="number"
                min={1200}
                max={12000}
                step={100}
                value={block.autoplayMs ?? 4500}
                onChange={(e) =>
                  set({ autoplayMs: Math.max(1200, Math.min(12000, pxInput(e.target.value))) })
                }
              />
            </Field>
            <Field label="Arrows">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={block.showArrows ?? true}
                  onChange={(e) => set({ showArrows: e.target.checked })}
                />
                Show controls
              </label>
            </Field>
          </div>
          <Field label="Subtitle">
            <Textarea
              rows={2}
              value={block.subtitle}
              onChange={(e) => set({ subtitle: e.target.value })}
            />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Primary button label">
              <Input
                value={block.primaryLabel ?? ""}
                onChange={(e) => set({ primaryLabel: e.target.value })}
              />
            </Field>
            <Field label="Primary button link">
              <Input
                value={block.primaryHref ?? ""}
                onChange={(e) => set({ primaryHref: e.target.value })}
              />
            </Field>
            <Field label="Secondary button label">
              <Input
                value={block.secondaryLabel ?? ""}
                onChange={(e) => set({ secondaryLabel: e.target.value })}
              />
            </Field>
            <Field label="Secondary button link">
              <Input
                value={block.secondaryHref ?? ""}
                onChange={(e) => set({ secondaryHref: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Carousel photos — click to add/remove">
            <PhotoPicker
              photos={photos}
              selectedIds={block.photoIds}
              onToggle={togglePhoto}
              containerClassName="max-h-72"
            />
          </Field>
          {selectedPhotos.length > 0 && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Selected order
              </p>
              <div className="space-y-2">
                {selectedPhotos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="flex items-center gap-2 rounded-md border p-2"
                  >
                    <div className="h-10 w-10 overflow-hidden rounded bg-[hsl(var(--muted))]">
                      {photo.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.thumbUrl}
                          alt={photo.label}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {photo.label}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={() =>
                        set({ photoIds: swapAt(block.photoIds, index, index - 1) })
                      }
                      aria-label="Move photo up"
                      className="h-8 w-8"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === selectedPhotos.length - 1}
                      onClick={() =>
                        set({ photoIds: swapAt(block.photoIds, index, index + 1) })
                      }
                      aria-label="Move photo down"
                      className="h-8 w-8"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        set({
                          photoIds: block.photoIds.filter((id) => id !== photo.id),
                        })
                      }
                      aria-label="Remove photo"
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    case "bookSlider": {
      const pages = block.pages ?? [];
      const updatePage = (
        index: number,
        patch: Partial<(typeof pages)[number]>,
      ) => {
        set({
          pages: pages.map((page, pageIndex) =>
            pageIndex === index ? { ...page, ...patch } : page,
          ),
        });
      };
      return (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <Field label="Title">
                <Input
                  value={block.title ?? ""}
                  onChange={(e) => set({ title: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Book size">
              <Select
                value={block.size ?? "standard"}
                onChange={(e) => set({ size: e.target.value as typeof block.size })}
              >
                <option value="compact">Compact</option>
                <option value="standard">Standard</option>
                <option value="large">Large</option>
              </Select>
            </Field>
            <Field label="Page feel">
              <Select
                value={block.pageStyle ?? "soft"}
                onChange={(e) =>
                  set({ pageStyle: e.target.value as typeof block.pageStyle })
                }
              >
                <option value="soft">Soft pages</option>
                <option value="hard">Hard cover feel</option>
              </Select>
            </Field>
            <Field label="Background">
              <Input
                type="color"
                value={block.backgroundColor ?? "#f7f1e8"}
                onChange={(e) => set({ backgroundColor: e.target.value })}
              />
            </Field>
            <Field label="Text color">
              <Input
                type="color"
                value={block.textColor ?? "#2d251d"}
                onChange={(e) => set({ textColor: e.target.value })}
              />
            </Field>
            <Field label="Accent color">
              <Input
                type="color"
                value={block.accentColor ?? "#8b5e34"}
                onChange={(e) => set({ accentColor: e.target.value })}
              />
            </Field>
            <Field label="Shadow strength">
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={block.shadowStrength ?? 0.45}
                onChange={(e) =>
                  set({
                    shadowStrength: Math.max(
                      0,
                      Math.min(1, Number(e.target.value) || 0),
                    ),
                  })
                }
              />
            </Field>
            <Field label="Paper texture">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={block.paperTexture ?? true}
                  onChange={(e) => set({ paperTexture: e.target.checked })}
                />
                Add paper and stain
              </label>
            </Field>
            <Field label="Showcase background">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={block.showcaseBackground ?? true}
                  onChange={(e) => set({ showcaseBackground: e.target.checked })}
                />
                Show background panel
              </label>
            </Field>
            <Field label="Controls">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={block.showControls ?? true}
                  onChange={(e) => set({ showControls: e.target.checked })}
                />
                Show arrows
              </label>
            </Field>
            <Field label="Page numbers">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={block.showPageNumbers ?? true}
                  onChange={(e) => set({ showPageNumbers: e.target.checked })}
                />
                Show progress
              </label>
            </Field>
          </div>
          <Field label="Subtitle">
            <Textarea
              rows={2}
              value={block.subtitle ?? ""}
              onChange={(e) => set({ subtitle: e.target.value })}
            />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Cover title">
              <Input
                value={block.coverTitle ?? ""}
                onChange={(e) => set({ coverTitle: e.target.value })}
              />
            </Field>
            <Field label="Cover subtitle">
              <Input
                value={block.coverSubtitle ?? ""}
                onChange={(e) => set({ coverSubtitle: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Cover photo">
                <PhotoPicker
                  photos={photos}
                  value={block.coverPhotoId ?? null}
                  onChange={(photoId) => set({ coverPhotoId: photoId })}
                  containerClassName="max-h-64"
                />
              </Field>
            </div>
          </div>
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Book pages</p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => set({ pages: [...pages, makeBookSliderPage(pages.length)] })}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add page
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    set({
                      pages: [
                        ...pages,
                        ...Array.from({ length: 3 }, (_, addIndex) =>
                          makeBookSliderPage(pages.length + addIndex),
                        ),
                      ],
                    })
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add 3 pages
                </Button>
              </div>
            </div>
            {pages.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-sm text-[hsl(var(--muted-foreground))]">
                Add at least one page to build the flipbook.
              </p>
            ) : (
              <div className="space-y-3">
                {pages.map((page, index) => (
                  <div key={page.id} className="space-y-3 rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 text-sm font-medium">
                        Page {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === 0}
                        onClick={() => set({ pages: swapAt(pages, index, index - 1) })}
                        aria-label="Move page up"
                        className="h-8 w-8"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === pages.length - 1}
                        onClick={() => set({ pages: swapAt(pages, index, index + 1) })}
                        aria-label="Move page down"
                        className="h-8 w-8"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          set({ pages: pages.filter((_, pageIndex) => pageIndex !== index) })
                        }
                        aria-label="Remove page"
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Field label="Photo">
                      <PhotoPicker
                        photos={photos}
                        value={page.photoId ?? null}
                        onChange={(photoId) => updatePage(index, { photoId })}
                        containerClassName="max-h-52"
                      />
                    </Field>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Image layout">
                        <Select
                          value={page.imageMode ?? "editorial"}
                          onChange={(e) =>
                            updatePage(index, {
                              imageMode: e.target.value as typeof page.imageMode,
                            })
                          }
                        >
                          <option value="editorial">Editorial split</option>
                          <option value="full">Full-page image</option>
                        </Select>
                      </Field>
                      <Field label="Headline">
                        <Input
                          value={page.headline ?? ""}
                          onChange={(e) =>
                            updatePage(index, { headline: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Subhead">
                        <Input
                          value={page.subhead ?? ""}
                          onChange={(e) =>
                            updatePage(index, { subhead: e.target.value })
                          }
                        />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Caption">
                          <Textarea
                            rows={2}
                            value={page.caption ?? ""}
                            onChange={(e) =>
                              updatePage(index, { caption: e.target.value })
                            }
                          />
                        </Field>
                      </div>
                      <Field label="Link label">
                        <Input
                          value={page.linkLabel ?? ""}
                          onChange={(e) =>
                            updatePage(index, { linkLabel: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Link URL">
                        <Input
                          value={page.linkHref ?? ""}
                          onChange={(e) =>
                            updatePage(index, { linkHref: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
    case "gallery": {
      const filterMode = block.filterMode ?? "none";
      const filterStyle = block.filterStyle ?? "flip-reveal";
      const toraPortfolioFilterTextSize = block.toraPortfolioFilterTextSize ?? 30;
      const toraPortfolioSeparatorSize = block.toraPortfolioSeparatorSize ?? 55;
      const customFilters = block.customFilters ?? [];
      const sortMode = (block.sortMode ?? "source") as GallerySortMode;
      const manualOrderPhotoIds = block.manualOrderPhotoIds ?? [];
      const filterSorts = block.filterSorts ?? [];
      const automaticFilterOptions =
        filterMode === "category"
          ? targets.category ?? []
          : filterMode === "location"
          ? targets.location ?? []
          : [];
      const automaticFilterKeys = new Set(automaticFilterOptions.map((option) => option.id));
      const automaticFilterSorts = filterSorts.filter((sort) =>
        automaticFilterKeys.has(sort.key),
      );
      const filterSortFor = (key: string) =>
        filterSorts.find((sort) => sort.key === key);
      const setFilterSorts = (next: typeof filterSorts) =>
        set({ filterSorts: next });
      const updateFilterSort = (
        key: string,
        patch: Partial<(typeof filterSorts)[number]>,
      ) => {
        const existing = filterSortFor(key);
        if (existing) {
          setFilterSorts(
            filterSorts.map((sort) =>
              sort.key === key ? { ...sort, ...patch } : sort,
            ),
          );
        } else {
          setFilterSorts([
            ...filterSorts,
            { key, sortMode: "source", photoIds: [], ...patch },
          ]);
        }
      };
      const removeFilterSort = (key: string) =>
        setFilterSorts(filterSorts.filter((sort) => sort.key !== key));
      const toggleManualPhoto = (ids: string[], photoId: string) =>
        ids.includes(photoId) ? ids.filter((id) => id !== photoId) : [...ids, photoId];
      const selectFilterSort = (key: string, value: string) => {
        if (value === "inherit") {
          removeFilterSort(key);
        } else {
          updateFilterSort(key, { sortMode: value as GallerySortMode });
        }
      };
      const updateFilter = (
        index: number,
        patch: Partial<(typeof customFilters)[number]>,
      ) => {
        set({
          customFilters: customFilters.map((filter, i) =>
            i === index ? { ...filter, ...patch } : filter,
          ),
        });
      };
      const toggleFilterPhoto = (index: number, photoId: string) => {
        const filter = customFilters[index];
        if (!filter) return;
        const current = filter.photoIds ?? [];
        updateFilter(index, {
          photoIds: current.includes(photoId)
            ? current.filter((id) => id !== photoId)
            : [...current, photoId],
        });
      };
      return (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {filterMode !== "custom" && (
              <Field label="Source">
                <Select value={block.source} onChange={(e) => set({ source: e.target.value as typeof block.source, targetId: null })}>
                  <option value="featured">Featured</option><option value="category">Category</option>
                  <option value="location">Location</option><option value="gallery">Gallery</option>
                </Select>
              </Field>
            )}
            {filterMode !== "custom" && block.source !== "featured" && (
              <Field label="Target">
                <Select value={block.targetId ?? ""} onChange={(e) => set({ targetId: e.target.value || null })}>
                  <option value="">Select…</option>
                  {(targets[block.source] ?? []).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Filter tabs">
              <Select
                value={filterMode}
                onChange={(e) => set({ filterMode: e.target.value as typeof block.filterMode })}
              >
                <option value="none">Off</option>
                <option value="category">By category</option>
                <option value="location">By location</option>
                <option value="custom">Custom</option>
              </Select>
            </Field>
            {filterMode !== "custom" && (
              <Field label="Max photos">
                <Input type="number" value={block.limit} onChange={(e) => set({ limit: Number(e.target.value) })} />
              </Field>
            )}
            {filterMode === "none" && (
              <>
                <Field label="Grid">
                  <Select
                    value={block.gridType}
                    onChange={(e) => {
                      const gridType = e.target.value as typeof block.gridType;
                      set({
                        gridType,
                        effect: "none",
                      });
                    }}
                  >
                    <option value="masonry">Masonry</option><option value="justified">Justified</option><option value="tora-justified-showcase">Tora justified showcase</option><option value="uniform">Uniform</option><option value="carousel">Carousel</option><option value="filmstrip">Filmstrip</option><option value="mosaic">Mosaic</option><option value="carousel3d">3D infinite carousel</option><option value="horizontal-lenis">Horizontal scroll</option><option value="cinematic">Cinematic 3D scroll</option><option value="tora-props-catalog">Tora props catalog</option>
                  </Select>
                </Field>
                {/* The 3D infinite carousel and cinematic 3D scroll manage their own
                    layout, so the tight/normal/airy spacing control doesn't apply. */}
                {block.gridType !== "carousel3d" &&
                  block.gridType !== "cinematic" &&
                  block.gridType !== "tora-props-catalog" &&
                  block.gridType !== "tora-justified-showcase" && (
                  <Field label="Spacing">
                    <Select value={block.spacing} onChange={(e) => set({ spacing: e.target.value as typeof block.spacing })}>
                      <option value="tight">Tight</option><option value="normal">Normal</option><option value="airy">Airy</option>
                    </Select>
                  </Field>
                )}
                {block.gridType === "carousel3d" && (
                  <Field label="Backdrop">
                    <Select value={block.backdrop ?? "color"} onChange={(e) => set({ backdrop: e.target.value as typeof block.backdrop })}>
                      <option value="color">Color (from photo)</option>
                      <option value="neutral">Neutral (no color)</option>
                    </Select>
                  </Field>
                )}
                {block.gridType === "carousel" && (
                  <Field label="Auto-roll">
                    <label className="flex h-9 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={block.autoplay ?? false}
                        onChange={(e) => set({ autoplay: e.target.checked })}
                      />
                      Advance slides automatically
                    </label>
                  </Field>
                )}
                {block.gridType === "cinematic" && (
                  <Field label="Scroll speed">
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0.2}
                        max={2}
                        step={0.05}
                        value={block.effectSpeed ?? 1}
                        onChange={(e) => set({ effectSpeed: Number(e.target.value) })}
                        className="w-full accent-[hsl(var(--primary))]"
                      />
                      <span className="w-10 text-right text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
                        {(block.effectSpeed ?? 1).toFixed(1)}×
                      </span>
                    </div>
                  </Field>
                )}
                {block.gridType === "tora-props-catalog" && (
                  <>
                    <Field label="Captions">
                      <label className="flex h-9 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={block.toraPropsShowCaptions ?? true}
                          onChange={(e) => set({ toraPropsShowCaptions: e.target.checked })}
                        />
                        Show below each photo
                      </label>
                    </Field>
                    <Field label="Caption source">
                      <Select
                        value={block.toraPropsCaptionSource ?? "auto"}
                        onChange={(e) =>
                          set({
                            toraPropsCaptionSource:
                              e.target.value as typeof block.toraPropsCaptionSource,
                          })
                        }
                        disabled={block.toraPropsShowCaptions === false}
                      >
                        <option value="auto">Auto</option>
                        <option value="headline">Headline</option>
                        <option value="alt">Alt text</option>
                        <option value="caption">Caption</option>
                      </Select>
                    </Field>
                    <Field label="Caption color">
                      <Input
                        type="color"
                        value={block.toraPropsCaptionColor ?? "#edd8aa"}
                        onChange={(e) => set({ toraPropsCaptionColor: e.target.value })}
                        disabled={block.toraPropsShowCaptions === false}
                      />
                    </Field>
                    <Field label="Background">
                      <label className="flex h-9 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={block.toraPropsShowBackground ?? true}
                          onChange={(e) => set({ toraPropsShowBackground: e.target.checked })}
                        />
                        Show showroom band
                      </label>
                    </Field>
                    <Field label="Background color">
                      <Input
                        type="color"
                        value={block.toraPropsBackgroundColor ?? "#252626"}
                        onChange={(e) => set({ toraPropsBackgroundColor: e.target.value })}
                        disabled={block.toraPropsShowBackground === false}
                      />
                    </Field>
                  </>
                )}
                {block.gridType === "tora-justified-showcase" && (
                  <>
                    <Field label="Title source">
                      <Select
                        value={block.toraJustifiedTitleSource ?? "auto"}
                        onChange={(e) =>
                          set({
                            toraJustifiedTitleSource:
                              e.target.value as typeof block.toraJustifiedTitleSource,
                          })
                        }
                      >
                        <option value="auto">Auto</option>
                        <option value="headline">Headline</option>
                        <option value="alt">Alt text</option>
                        <option value="caption">Caption</option>
                      </Select>
                    </Field>
                    <Field label="Title color">
                      <Input
                        type="color"
                        value={block.toraJustifiedTitleColor ?? "#f7f7f7"}
                        onChange={(e) => set({ toraJustifiedTitleColor: e.target.value })}
                      />
                    </Field>
                    <Field label="Accent color">
                      <Input
                        type="color"
                        value={block.toraJustifiedAccentColor ?? "#edd8aa"}
                        onChange={(e) => set({ toraJustifiedAccentColor: e.target.value })}
                      />
                    </Field>
                    <Field label="Background">
                      <label className="flex h-9 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={block.toraJustifiedUseBackground ?? true}
                          onChange={(e) => set({ toraJustifiedUseBackground: e.target.checked })}
                        />
                        Use background color
                      </label>
                    </Field>
                    <Field label="Background color">
                      <Input
                        type="color"
                        value={block.toraJustifiedBackgroundColor ?? "#252626"}
                        onChange={(e) => set({ toraJustifiedBackgroundColor: e.target.value })}
                        disabled={block.toraJustifiedUseBackground === false}
                      />
                    </Field>
                    <Field label="Row height">
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={5}
                          max={10}
                          step={0.25}
                          value={block.toraJustifiedRowHeightFactor ?? 7}
                          onChange={(e) =>
                            set({
                              toraJustifiedRowHeightFactor: Math.min(
                                10,
                                Math.max(5, Number(e.target.value) || 7),
                              ),
                            })
                          }
                          className="w-full accent-[hsl(var(--primary))]"
                        />
                        <span className="w-10 text-right text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
                          /{(block.toraJustifiedRowHeightFactor ?? 7).toFixed(2)}
                        </span>
                      </div>
                    </Field>
                    <Field label="Desktop gutter">
                      <Input
                        type="number"
                        min={0}
                        max={60}
                        value={block.toraJustifiedDesktopGutter ?? 25}
                        onChange={(e) =>
                          set({
                            toraJustifiedDesktopGutter: Math.min(
                              60,
                              Math.max(0, Number(e.target.value) || 0),
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field label="Mobile gutter">
                      <Input
                        type="number"
                        min={0}
                        max={40}
                        value={block.toraJustifiedMobileGutter ?? 15}
                        onChange={(e) =>
                          set({
                            toraJustifiedMobileGutter: Math.min(
                              40,
                              Math.max(0, Number(e.target.value) || 0),
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field label="Thumbnail hover">
                      <label className="flex h-9 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={block.toraJustifiedHoverInset ?? true}
                          onChange={(e) => set({ toraJustifiedHoverInset: e.target.checked })}
                        />
                        Clip and fade on hover
                      </label>
                    </Field>
                    <Field label="Lead hover dim">
                      <label className="flex h-9 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={block.toraJustifiedDimOnLeadHover ?? true}
                          onChange={(e) => set({ toraJustifiedDimOnLeadHover: e.target.checked })}
                        />
                        Dim surrounding page
                      </label>
                    </Field>
                    <Field label="Thumbnail select">
                      <label className="flex h-9 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={block.toraJustifiedScrollOnSelect ?? true}
                          onChange={(e) => set({ toraJustifiedScrollOnSelect: e.target.checked })}
                        />
                        Scroll back to lead image
                      </label>
                    </Field>
                    <Field label="Lead image backdrop">
                      <label className="flex h-9 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={block.toraJustifiedShowBlurredSideFill ?? true}
                          onChange={(e) =>
                            set({
                              toraJustifiedShowBlurredSideFill: e.target.checked,
                            })
                          }
                        />
                        Show blurred side fill
                      </label>
                    </Field>
                  </>
                )}
              </>
            )}
          </div>
          {filterMode !== "none" && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Filter style">
                  <Select
                    value={filterStyle}
                    onChange={(e) =>
                      set({
                        filterStyle: e.target.value as typeof filterStyle,
                      })
                    }
                  >
                    <option value="flip-reveal">Flip reveal</option>
                    <option value="tora-portfolio-masonry">Tora portfolio masonry</option>
                  </Select>
                </Field>
                <Field label="Default sort">
                  <Select
                    value={sortMode}
                    onChange={(e) =>
                      set({ sortMode: e.target.value as GallerySortMode })
                    }
                  >
                    {GALLERY_SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label={
                    filterStyle === "tora-portfolio-masonry"
                      ? "Hover overlay"
                      : "Image overlay text"
                  }
                >
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.showOverlayText ?? true}
                      onChange={(e) => set({ showOverlayText: e.target.checked })}
                    />
                    {filterStyle === "tora-portfolio-masonry"
                      ? "Show camera overlay"
                      : "Show text over photos"}
                  </label>
                </Field>
                {filterStyle === "tora-portfolio-masonry" && (
                  <>
                    <Field label="Pagination text size">
                      <BoundedNumberInput
                        min={18}
                        max={48}
                        fallback={30}
                        value={toraPortfolioFilterTextSize}
                        onValueChange={(value) =>
                          set({
                            toraPortfolioFilterTextSize: value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Separator size">
                      <BoundedNumberInput
                        min={16}
                        max={90}
                        fallback={55}
                        value={toraPortfolioSeparatorSize}
                        onValueChange={(value) =>
                          set({
                            toraPortfolioSeparatorSize: value,
                          })
                        }
                      />
                    </Field>
                  </>
                )}
              </div>
              {sortMode === "custom" && (
                <div className="space-y-2">
                  <PhotoPicker
                    photos={photos}
                    selectedIds={manualOrderPhotoIds}
                    onToggle={(photoId) =>
                      set({
                        manualOrderPhotoIds: toggleManualPhoto(
                          manualOrderPhotoIds,
                          photoId,
                        ),
                      })
                    }
                    containerClassName="max-h-48"
                  />
                  <PhotoOrderList
                    photos={photos}
                    ids={manualOrderPhotoIds}
                    onChange={(ids) => set({ manualOrderPhotoIds: ids })}
                  />
                </div>
              )}
              {(filterMode === "category" || filterMode === "location") && (
                <div className="space-y-2">
                  {automaticFilterSorts.map((sort, index) => (
                    <div key={`${sort.key}-${index}`} className="rounded-md border p-2">
                      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <Field label="Filter">
                          <Select
                            value={sort.key}
                            onChange={(e) =>
                              setFilterSorts(
                                filterSorts.map((item) =>
                                  item.key === sort.key
                                    ? { ...item, key: e.target.value }
                                    : item,
                                ),
                              )
                            }
                          >
                            {automaticFilterOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Sort">
                          <Select
                            value={sort.sortMode}
                            onChange={(e) =>
                              updateFilterSort(sort.key, {
                                sortMode: e.target.value as GallerySortMode,
                              })
                            }
                          >
                            {GALLERY_SORT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFilterSort(sort.key)}
                          aria-label="Remove filter sort"
                          className="self-end"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {sort.sortMode === "custom" && (
                        <div className="mt-2 space-y-2">
                          <PhotoPicker
                            photos={photos}
                            selectedIds={sort.photoIds ?? []}
                            onToggle={(photoId) =>
                              updateFilterSort(sort.key, {
                                photoIds: toggleManualPhoto(
                                  sort.photoIds ?? [],
                                  photoId,
                                ),
                              })
                            }
                            containerClassName="max-h-48"
                          />
                          <PhotoOrderList
                            photos={photos}
                            ids={sort.photoIds ?? []}
                            onChange={(ids) =>
                              updateFilterSort(sort.key, { photoIds: ids })
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={automaticFilterOptions.length === 0}
                    onClick={() => {
                      const available =
                        automaticFilterOptions.find(
                          (option) => !filterSorts.some((sort) => sort.key === option.id),
                        ) ?? automaticFilterOptions[0];
                      if (!available) return;
                      updateFilterSort(available.id, { sortMode: "source" });
                    }}
                    className="w-full justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add filter sort
                  </Button>
                </div>
              )}
            </div>
          )}
          {filterMode === "custom" && (
            <div className="space-y-3">
              {customFilters.map((filter, index) => (
                <div key={filter.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <Field label={`Custom tab ${index + 1}`}>
                        <Input
                          value={filter.label ?? ""}
                          onChange={(e) => updateFilter(index, { label: e.target.value })}
                        />
                      </Field>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        set({
                          customFilters: customFilters.filter((_, i) => i !== index),
                        })
                      }
                      aria-label="Remove custom filter"
                      className="mt-6 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <PhotoPicker
                    photos={photos}
                    selectedIds={filter.photoIds ?? []}
                    onToggle={(photoId) => toggleFilterPhoto(index, photoId)}
                    containerClassName="max-h-60"
                  />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Field label="Tab sort">
                      <Select
                        value={filterSortFor(filter.id)?.sortMode ?? "inherit"}
                        onChange={(e) => selectFilterSort(filter.id, e.target.value)}
                      >
                        <option value="inherit">Use default sort</option>
                        {GALLERY_SORT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  {((filterSortFor(filter.id)?.sortMode ?? sortMode) === "custom") && (
                    <div className="mt-2">
                      <PhotoOrderList
                        photos={photos}
                        ids={filter.photoIds ?? []}
                        onChange={(photoIds) => updateFilter(index, { photoIds })}
                      />
                    </div>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  set({
                    customFilters: [
                      ...customFilters,
                      {
                        id: newBlockId(),
                        label: `Filter ${customFilters.length + 1}`,
                        photoIds: [],
                      },
                    ],
                  })
                }
                className="w-full justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add custom filter
              </Button>
            </div>
          )}
        </div>
      );
    }
    case "banner": {
      const isPrisma = block.layout === "prisma-hero";
      const isAgency = block.layout === "agency-viral-hero";
      const isToraMochie = block.layout?.startsWith("toramochie-") ?? false;
      const isToraWall = block.layout === "toramochie-full-wall";
      const isToraWedding = block.layout === "toramochie-wedding-studio";
      const isToraOnlyImage = block.layout === "toramochie-only-image";
      const isToraMinimal = block.layout === "toramochie-minimal-slider";
      const isToraFullWidthSlider = block.layout === "toramochie-full-width-slider";
      const isToraSlider = isToraMinimal || isToraFullWidthSlider;
      const isToraMultiPhoto = isToraWall || isToraWedding;
      const isSpecialHero = isPrisma || isAgency;
      const bannerPhotoIds = block.photoIds ?? [];
      const bannerSlides = block.slides ?? [];
      const selectedBannerPhotos = bannerPhotoIds
        .map((photoId) => photos.find((photo) => photo.id === photoId))
        .filter((photo): photo is PhotoOption => Boolean(photo));
      const updateBannerSlide = (
        index: number,
        patch: Partial<(typeof bannerSlides)[number]>,
      ) => {
        set({
          slides: bannerSlides.map((slide, slideIndex) =>
            slideIndex === index ? { ...slide, ...patch } : slide,
          ),
        });
      };
      const updateBannerLayout = (layout: typeof block.layout) => {
        const patch: Partial<LeafBlock> = { layout };
        if (layout === "toramochie-full-wall") {
          if (!block.headline.trim()) patch.headline = TORA_MOCHIE_DEFAULT_HEADLINE;
          if (!(block.typewriterWords ?? "").trim()) {
            patch.typewriterWords = TORA_MOCHIE_DEFAULT_TYPED_WORDS;
          }
        } else if (layout === "toramochie-only-image") {
          if (!block.headline.trim() || block.headline === "Image banner") {
            patch.headline = "CLIENTS";
          }
          patch.eyebrow = "";
          patch.subhead = "";
          patch.ctaLabel = "";
          patch.overlay = block.overlay === "none" ? "none" : "auto";
          patch.effect = "none";
        } else if (layout === "toramochie-wedding-studio") {
          patch.headline = block.headline.trim() || "Welcome to Reflector Wedding Photography!";
          patch.subhead =
            block.subhead.trim() ||
            "We're a team, based in South of France, documenting elopements & weddings all across Europe and overseas! And we can't wait to hear from you!";
          patch.ctaLabel = block.ctaLabel || "GET IN TOUCH";
          patch.ctaHref = block.ctaHref || "#";
          patch.overlay = "none";
          patch.height = block.height === "short" ? "tall" : block.height;
        } else if (
          layout === "toramochie-minimal-slider" ||
          layout === "toramochie-full-width-slider"
        ) {
          patch.height = "full";
          patch.overlay = "none";
          patch.effect = "none";
          patch.source = "photo";
          patch.slides =
            bannerSlides.length > 0
              ? bannerSlides
              : Array.from({ length: 4 }, (_, index) =>
                  layout === "toramochie-full-width-slider"
                    ? makeFullWidthBannerSlide(index, bannerPhotoIds[index] ?? null)
                    : makeBannerSlide(index, bannerPhotoIds[index] ?? null),
                );
          patch.minimalSliderAutoplay ??= layout === "toramochie-full-width-slider";
          patch.minimalSliderAutoplayMs ??=
            layout === "toramochie-full-width-slider" ? 5000 : 4500;
          if (layout === "toramochie-full-width-slider") {
            patch.fullWidthSliderAccentColor ??= "#f7f7f7";
            patch.fullWidthSliderDimImages ??= true;
          }
        }
        set(patch);
      };
      const toggleBannerPhoto = (photoId: string) =>
        set({
          photoIds: bannerPhotoIds.includes(photoId)
            ? bannerPhotoIds.filter((id) => id !== photoId)
            : [...bannerPhotoIds, photoId],
        });
      const layoutField = (
        <Field label="Layout">
          <Select
            value={block.layout ?? "bottom-left"}
            onChange={(e) => updateBannerLayout(e.target.value as typeof block.layout)}
          >
            <optgroup label="Standard">
              <option value="bottom-left">Bottom left</option>
              <option value="bottom-right">Bottom right</option>
              <option value="center">Centered</option>
              <option value="split-left">Split · image left</option>
              <option value="split-right">Split · image right</option>
              <option value="split-top">Split · image top</option>
              <option value="split-bottom">Split · image bottom</option>
            </optgroup>
            <optgroup label="Hero references">
              <option value="prisma-hero">Prisma hero</option>
              <option value="agency-viral-hero">Agency viral hero</option>
            </optgroup>
            <optgroup label="ToraMochie image banner">
              <option value="toramochie-modern">Modern</option>
              <option value="toramochie-creative">Creative</option>
              <option value="toramochie-simple">Simple</option>
              <option value="toramochie-full-wall">Full wall</option>
              <option value="toramochie-bottom-text">Bottom text</option>
              <option value="toramochie-only-image">Only image</option>
              <option value="toramochie-classic">Classic</option>
              <option value="toramochie-wedding-studio">Wedding studio</option>
              <option value="toramochie-minimal-slider">Minimal slider</option>
              <option value="toramochie-full-width-slider">Full width slider</option>
            </optgroup>
          </Select>
        </Field>
      );
      // Source / darken / layout trio (top-left in both source modes).
      const cfg = (
        <>
          <Field label={isToraMultiPhoto ? "Images source" : "Image source"}>
            <Select value={block.source} onChange={(e) => set({ source: e.target.value as typeof block.source })}>
              <option value="featured">Latest featured</option>
              <option value="photo">{isToraMultiPhoto ? "Selected photos" : "Specific photo"}</option>
            </Select>
          </Field>
          {isSpecialHero ? (
            <Field label="Background overlay">
              <Select value={block.overlay ?? "auto"} onChange={(e) => set({ overlay: e.target.value as typeof block.overlay })}>
                <option value="auto">Soft darken</option>
                <option value="none">None</option>
                <option value="dark">Strong darken</option>
              </Select>
            </Field>
          ) : !isSpecialHero && !isToraSlider && (
            <Field label="Darken image">
              <Select value={block.overlay ?? "auto"} onChange={(e) => set({ overlay: e.target.value as typeof block.overlay })}>
                <option value="auto">Auto (only behind text)</option>
                <option value="none">None</option>
                <option value="dark">Always darken</option>
              </Select>
            </Field>
          )}
          {layoutField}
        </>
      );
      const focalField = (
        <Field label="Image position">
          <FocalPointPicker
            x={block.focalX ?? 50}
            y={block.focalY ?? 50}
            thumbUrl={photos.find((p) => p.id === block.photoId)?.thumbUrl ?? null}
            onChange={(fx, fy) => set({ focalX: fx, focalY: fy })}
          />
        </Field>
      );
      const zoomField = (
        <Field label="Zoom">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={block.zoom ?? 1}
              onChange={(e) => set({ zoom: Number(e.target.value) })}
              className="w-full accent-[hsl(var(--primary))]"
            />
            <span className="w-10 text-right text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
              {Math.round((block.zoom ?? 1) * 100)}%
            </span>
          </div>
        </Field>
      );
      const rest = (
        <>
          {!isToraOnlyImage && (
            <Field label="Small label">
              <Input
                value={block.eyebrow ?? ""}
                onChange={(e) => set({ eyebrow: e.target.value })}
                placeholder={isToraMochie ? "Image banner" : ""}
              />
            </Field>
          )}
          {isToraOnlyImage && (
            <Field label="Small label (optional)">
              <Input
                value={block.eyebrow ?? ""}
                onChange={(e) => set({ eyebrow: e.target.value })}
              />
            </Field>
          )}
          <Field label={isAgency ? "Headline line 1" : "Headline"}><Input value={block.headline} onChange={(e) => set({ headline: e.target.value })} /></Field>
          {!isToraOnlyImage && (
            <Field label="Subhead"><Input value={block.subhead} onChange={(e) => set({ subhead: e.target.value })} /></Field>
          )}
          {isToraWall && (
            <Field label="Typed words">
              <Input
                value={block.typewriterWords ?? ""}
                onChange={(e) => set({ typewriterWords: e.target.value })}
                placeholder="life., action., people."
              />
            </Field>
          )}
          {isAgency && (
            <Field label="Italic headline line">
              <Input
                value={block.agencyAccentText ?? ""}
                onChange={(e) => set({ agencyAccentText: e.target.value })}
                placeholder="videos & reels viral"
              />
            </Field>
          )}
          {!isSpecialHero && !isToraOnlyImage && (
            <>
              <Field label="Headline font">
                <Select value={block.headlineFont ?? "sans"} onChange={(e) => set({ headlineFont: e.target.value as typeof block.headlineFont })}>
                  <option value="sans">Sans</option><option value="serif">Serif</option>
                </Select>
              </Field>
              <Field label="Headline size">
                <Select value={block.headlineSize ?? "lg"} onChange={(e) => set({ headlineSize: e.target.value as typeof block.headlineSize })}>
                  <option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option><option value="xl">Extra large</option>
                </Select>
              </Field>
              <Field label="Letter spacing">
                <Select value={block.headlineTracking ?? "normal"} onChange={(e) => set({ headlineTracking: e.target.value as typeof block.headlineTracking })}>
                  <option value="normal">Normal</option><option value="wide">Wide</option><option value="widest">Widest</option>
                </Select>
              </Field>
              <Field label="Headline case">
                <Select value={block.headlineCase ?? "normal"} onChange={(e) => set({ headlineCase: e.target.value as typeof block.headlineCase })}>
                  <option value="normal">As typed</option><option value="upper">UPPERCASE</option>
                </Select>
              </Field>
            </>
          )}
          {!isToraOnlyImage && (
            <>
              <Field label="Button label"><Input value={block.ctaLabel ?? ""} onChange={(e) => set({ ctaLabel: e.target.value })} /></Field>
              <Field label="Button link"><Input value={block.ctaHref ?? ""} onChange={(e) => set({ ctaHref: e.target.value })} /></Field>
            </>
          )}
          {!isSpecialHero && !isToraOnlyImage && (
            <Field label="Button style">
              <Select value={block.buttonStyle ?? "solid"} onChange={(e) => set({ buttonStyle: e.target.value as typeof block.buttonStyle })}>
                <option value="solid">Solid</option><option value="pill">Pill</option><option value="outline">Outline</option><option value="link">Text link</option>
              </Select>
            </Field>
          )}
          {!isToraOnlyImage && (
            <Field label="Height">
              <Select value={block.height} onChange={(e) => set({ height: e.target.value as typeof block.height })}>
                <option value="short">Short</option><option value="tall">Tall</option><option value="full">Full</option>
              </Select>
            </Field>
          )}
          {isPrisma ? (
            <>
              <div className="sm:col-span-2">
                <Field label="Background video URL">
                  <Input
                    value={block.prismaVideoUrl ?? ""}
                    onChange={(e) => set({ prismaVideoUrl: e.target.value })}
                    placeholder="https://.../video.mp4"
                  />
                </Field>
              </div>
              <Field label="Asterisk mark">
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={block.prismaShowAsterisk ?? true}
                    onChange={(e) => set({ prismaShowAsterisk: e.target.checked })}
                  />
                  Show beside headline
                </label>
              </Field>
            </>
          ) : isAgency ? (
            <div className="sm:col-span-2">
              <Field label="Background video URL">
                <Input
                  value={block.agencyVideoUrl ?? ""}
                  onChange={(e) => set({ agencyVideoUrl: e.target.value })}
                  placeholder="https://.../video.mp4"
                />
              </Field>
            </div>
          ) : (
            <Field label="Effect">
              <Select value={block.effect} onChange={(e) => set({ effect: e.target.value as typeof block.effect })}>
                <option value="none">None</option>
                <option value="ken-burns">Ken Burns (slow zoom)</option>
                <option value="reveal">Load reveal</option>
                <option value="css-glitch-1">CSS glitch - haunted</option>
                <option value="css-glitch-2">CSS glitch - ethereal</option>
                <option value="webgl-distortion">WebGL distortion</option>
              </Select>
            </Field>
          )}
        </>
      );
      if (isToraSlider) {
        return (
          <div className="space-y-4">
            <SettingsGroup title={isToraFullWidthSlider ? "Full width slider" : "Minimal slider"}>
              <div className="grid gap-2 sm:grid-cols-2">
                {layoutField}
                <Field label="Height">
                  <Select value={block.height} onChange={(e) => set({ height: e.target.value as typeof block.height })}>
                    <option value="short">Short</option><option value="tall">Tall</option><option value="full">Full</option>
                  </Select>
                </Field>
                <Field label="Autoplay">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.minimalSliderAutoplay ?? false}
                      onChange={(e) => set({ minimalSliderAutoplay: e.target.checked })}
                    />
                    Auto advance slides
                  </label>
                </Field>
                <Field label="Autoplay speed">
                  <Input
                    type="number"
                    min={1200}
                    max={12000}
                    step={100}
                    value={
                      block.minimalSliderAutoplayMs ??
                      (isToraFullWidthSlider ? 5000 : 4500)
                    }
                    onChange={(e) =>
                      set({
                        minimalSliderAutoplayMs: Math.max(
                          1200,
                          Math.min(12000, pxInput(e.target.value)),
                        ),
                      })
                    }
                  />
                </Field>
                {isToraFullWidthSlider && (
                  <>
                    <Field label="Accent color">
                      <Input
                        type="color"
                        value={block.fullWidthSliderAccentColor ?? "#f7f7f7"}
                        onChange={(e) => set({ fullWidthSliderAccentColor: e.target.value })}
                      />
                    </Field>
                    <Field label="Slide dimming">
                      <label className="flex h-9 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={block.fullWidthSliderDimImages ?? true}
                          onChange={(e) => set({ fullWidthSliderDimImages: e.target.checked })}
                        />
                        Dim slide photos
                      </label>
                    </Field>
                  </>
                )}
              </div>
            </SettingsGroup>

            <SettingsGroup title="Slides">
              <div className="mb-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    set({
                      slides: [
                        ...bannerSlides,
                        isToraFullWidthSlider
                          ? makeFullWidthBannerSlide(bannerSlides.length)
                          : makeBannerSlide(bannerSlides.length),
                      ],
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add slide
                </Button>
              </div>
              <div className="space-y-3">
                {bannerSlides.length === 0 && (
                  <p className="rounded-md border border-dashed px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                    {isToraFullWidthSlider
                      ? "Add slides to set per-photo titles and links."
                      : "Add slides to set per-photo titles and buttons."}
                  </p>
                )}
                {bannerSlides.map((slide, index) => {
                  const photo = photos.find((item) => item.id === slide.photoId);
                  return (
                    <div key={slide.id} className="space-y-3 rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 text-sm font-medium">
                          Slide {index + 1}
                          {slide.headline ? ` · ${slide.headline}` : ""}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === 0}
                          onClick={() => set({ slides: swapAt(bannerSlides, index, index - 1) })}
                          aria-label="Move slide up"
                          className="h-8 w-8"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === bannerSlides.length - 1}
                          onClick={() => set({ slides: swapAt(bannerSlides, index, index + 1) })}
                          aria-label="Move slide down"
                          className="h-8 w-8"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            set({
                              slides: bannerSlides.filter((_, slideIndex) => slideIndex !== index),
                            })
                          }
                          aria-label="Remove slide"
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-[13rem_1fr]">
                        <Field label="Photo">
                          <PhotoPicker
                            photos={photos}
                            value={slide.photoId ?? null}
                            onChange={(photoId) => updateBannerSlide(index, { photoId })}
                            containerClassName="max-h-52"
                          />
                        </Field>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {!isToraFullWidthSlider && (
                            <Field label="Subtitle">
                              <Input
                                value={slide.subtitle ?? ""}
                                onChange={(e) => updateBannerSlide(index, { subtitle: e.target.value })}
                                placeholder="for couples"
                              />
                            </Field>
                          )}
                          <Field label="Headline">
                            <Input
                              value={slide.headline ?? ""}
                              onChange={(e) => updateBannerSlide(index, { headline: e.target.value })}
                              placeholder={isToraFullWidthSlider ? "London's portraits" : "Another way"}
                            />
                          </Field>
                          {!isToraFullWidthSlider && (
                            <Field label="Button label">
                              <Input
                                value={slide.buttonLabel ?? ""}
                                onChange={(e) => updateBannerSlide(index, { buttonLabel: e.target.value })}
                                placeholder="Read More"
                              />
                            </Field>
                          )}
                          <Field label={isToraFullWidthSlider ? "Title link" : "Button link"}>
                            <Input
                              value={slide.buttonHref ?? ""}
                              onChange={(e) => updateBannerSlide(index, { buttonHref: e.target.value })}
                              placeholder="#"
                            />
                          </Field>
                        </div>
                      </div>
                      {photo && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          Selected: {photo.label}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </SettingsGroup>
          </div>
        );
      }
      // Featured: no photo picker, so put the (tall) Image position beside the
      // source/darken/layout trio, then flow zoom + text below.
      if (block.source === "featured") {
        return (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">{cfg}</div>
              {focalField}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {zoomField}
              {rest}
            </div>
          </div>
        );
      }
      // Specific photo: trio + Image position on the left; the Photo picker fills
      // the right column so its bottom lines up with the Image position bottom.
      return (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-2">
              {cfg}
              {focalField}
            </div>
            <div className="flex h-full flex-col gap-1.5">
              <Label>{isToraMultiPhoto ? "Photos" : "Photo"}</Label>
              {isToraMultiPhoto ? (
                <PhotoPicker
                  photos={photos}
                  selectedIds={bannerPhotoIds}
                  onToggle={toggleBannerPhoto}
                  containerClassName="min-h-0 flex-1"
                />
              ) : (
                <PhotoPicker
                  photos={photos}
                  value={block.photoId ?? null}
                  onChange={(pid) => set({ photoId: pid })}
                  containerClassName="min-h-0 flex-1"
                />
              )}
            </div>
          </div>
          {isToraMultiPhoto && selectedBannerPhotos.length > 0 && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Selected order
              </p>
              <div className="space-y-2">
                {selectedBannerPhotos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="flex items-center gap-2 rounded-md border p-2"
                  >
                    <div className="h-10 w-10 overflow-hidden rounded bg-[hsl(var(--muted))]">
                      {photo.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.thumbUrl}
                          alt={photo.label}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {photo.label}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={() =>
                        set({ photoIds: swapAt(bannerPhotoIds, index, index - 1) })
                      }
                      aria-label="Move photo up"
                      className="h-8 w-8"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === selectedBannerPhotos.length - 1}
                      onClick={() =>
                        set({ photoIds: swapAt(bannerPhotoIds, index, index + 1) })
                      }
                      aria-label="Move photo down"
                      className="h-8 w-8"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        set({
                          photoIds: bannerPhotoIds.filter((id) => id !== photo.id),
                        })
                      }
                      aria-label="Remove photo"
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {zoomField}
            {rest}
          </div>
        </div>
      );
    }
    case "spacer":
      return (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Desktop height">
              <Select
                value={block.size}
                onChange={(e) =>
                  set({ size: e.target.value as typeof block.size })
                }
              >
                <option value="xs">Extra small</option>
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
                <option value="xl">Extra large</option>
                <option value="custom">Custom</option>
              </Select>
            </Field>
            <Field label="Mobile height">
              <Select
                value={block.mobileSize ?? "same"}
                onChange={(e) =>
                  set({ mobileSize: e.target.value as typeof block.mobileSize })
                }
              >
                <option value="same">Same as desktop</option>
                <option value="xs">Extra small</option>
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
                <option value="xl">Extra large</option>
                <option value="custom">Custom</option>
              </Select>
            </Field>
            {block.size === "custom" && (
              <Field label="Desktop custom height">
                <Input
                  type="number"
                  min={0}
                  max={640}
                  value={block.customHeight ?? 112}
                  onChange={(e) =>
                    set({ customHeight: pxInput(e.target.value) })
                  }
                />
              </Field>
            )}
            {block.mobileSize === "custom" && (
              <Field label="Mobile custom height">
                <Input
                  type="number"
                  min={0}
                  max={640}
                  value={block.mobileCustomHeight ?? 112}
                  onChange={(e) =>
                    set({ mobileCustomHeight: pxInput(e.target.value) })
                  }
                />
              </Field>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Background">
              <Select
                value={block.backgroundMode ?? "none"}
                onChange={(e) =>
                  set({
                    backgroundMode: e.target.value as typeof block.backgroundMode,
                  })
                }
              >
                <option value="none">No background</option>
                <option value="muted">Theme muted</option>
                <option value="custom">Custom color</option>
              </Select>
            </Field>
            {(block.backgroundMode ?? "none") !== "none" && (
              <Field label="Background width">
                <Select
                  value={block.backgroundWidth ?? "full"}
                  onChange={(e) =>
                    set({
                      backgroundWidth: e.target.value as typeof block.backgroundWidth,
                    })
                  }
                >
                  <option value="full">Full page band</option>
                  <option value="content">Content width</option>
                </Select>
              </Field>
            )}
            {(block.backgroundMode ?? "none") === "custom" && (
              <Field label="Background color">
                <Input
                  type="color"
                  value={block.backgroundColor ?? "#f4f4f5"}
                  onChange={(e) => set({ backgroundColor: e.target.value })}
                />
              </Field>
            )}
          </div>
        </div>
      );
    case "categoryIndex":
    case "locationIndex":
      return <Field label="Title"><Input value={block.title} onChange={(e) => set({ title: e.target.value })} /></Field>;
    case "locationMap": {
      const locs = targets.location ?? [];
      const chosen = block.locationIds ?? [];
      const pins = block.customPins ?? [];
      const unchosen = locs.filter((loc) => !chosen.includes(loc.id));
      const labelOf = (id: string) => locs.find((loc) => loc.id === id)?.label ?? "(removed)";
      const photoCountOf = (id: string) => locs.find((loc) => loc.id === id)?.photoCount ?? 0;
      const locationOptionLabel = (loc: Opt) =>
        `${loc.label} (${loc.photoCount ?? 0} ${(loc.photoCount ?? 0) === 1 ? "photo" : "photos"})`;
      const shownLocationIds = chosen.length > 0 ? chosen : locs.map((loc) => loc.id);
      const pointOptions = [
        ...shownLocationIds.map((id) => ({
          id,
          label: labelOf(id),
        })),
        ...pins.map((pin, index) => ({
          id: `custom-${pin.id}`,
          label: pin.title || `Custom pin ${index + 1}`,
        })),
      ];
      const connections = block.networkConnections ?? [];
      const routePointIds = block.routePointIds ?? [];
      const routeStopOptions = pointOptions.filter((point) => !routePointIds.includes(point.id));
      const planningStopOptions = pointOptions.filter(
        (point) =>
          !routePointIds.includes(point.id) &&
          point.id !== (block.routeStartId ?? "") &&
          point.id !== (block.routeEndId ?? ""),
      );
      const updatePin = (index: number, patch: Partial<(typeof pins)[number]>) =>
        set({
          customPins: pins.map((pin, pinIndex) =>
            pinIndex === index ? { ...pin, ...patch } : pin,
          ),
        });
      const updateConnection = (
        index: number,
        patch: Partial<(typeof connections)[number]>,
      ) =>
        set({
          networkConnections: connections.map((connection, connectionIndex) =>
            connectionIndex === index ? { ...connection, ...patch } : connection,
          ),
        });
      return (
        <div className="flex flex-col gap-4">
          <div className="order-2">
            <SettingsGroup
              title="Map content"
              description="Mix published taxonomy locations with one-off custom pins."
            >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title">
                <Input value={block.title} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Field label="Subtitle">
                <Input value={block.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
              </Field>
            </div>
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  Taxonomy locations
                </p>
                {chosen.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => set({ locationIds: [] })}
                  >
                    Use all
                  </Button>
                )}
              </div>
              {chosen.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Showing all mapped published locations.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {chosen.map((id) => (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-2 rounded-md bg-[hsl(var(--muted))] px-2 py-1.5 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {labelOf(id)} ({photoCountOf(id)})
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => set({ locationIds: chosen.filter((x) => x !== id) })}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {unchosen.length > 0 && (
                <Select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    set({ locationIds: [...chosen, e.target.value] });
                  }}
                >
                  <option value="">+ Add specific location...</option>
                  {unchosen.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {locationOptionLabel(loc)}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    Custom pins
                  </p>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    Add one-off coordinates with an optional photo cover and link.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    set({ customPins: [...pins, makeLocationMapPin(pins.length)] })
                  }
                >
                  Add pin
                </Button>
              </div>
              {pins.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  No custom pins yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {pins.map((pin, index) => (
                    <div key={pin.id} className="space-y-3 rounded-lg bg-[hsl(var(--muted))]/55 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">
                          {pin.title || `Custom pin ${index + 1}`}
                        </p>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={index === 0}
                            onClick={() => set({ customPins: swapAt(pins, index, index - 1) })}
                            aria-label="Move pin up"
                            className="h-8 w-8"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={index === pins.length - 1}
                            onClick={() => set({ customPins: swapAt(pins, index, index + 1) })}
                            aria-label="Move pin down"
                            className="h-8 w-8"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              set({ customPins: pins.filter((_, pinIndex) => pinIndex !== index) })
                            }
                            aria-label="Remove pin"
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Pin title">
                          <Input
                            value={pin.title}
                            onChange={(e) => updatePin(index, { title: e.target.value })}
                          />
                        </Field>
                        <Field label="Subtitle / label">
                          <Input
                            value={pin.subtitle}
                            onChange={(e) => updatePin(index, { subtitle: e.target.value })}
                            placeholder="Venue, city, or short note"
                          />
                        </Field>
                        <Field label="Latitude">
                          <Input
                            type="number"
                            step="any"
                            min={-90}
                            max={90}
                            value={pin.lat}
                            onChange={(e) => updatePin(index, { lat: e.target.value })}
                            placeholder="34.0522"
                          />
                        </Field>
                        <Field label="Longitude">
                          <Input
                            type="number"
                            step="any"
                            min={-180}
                            max={180}
                            value={pin.lng}
                            onChange={(e) => updatePin(index, { lng: e.target.value })}
                            placeholder="-118.2437"
                          />
                        </Field>
                        <Field label="Link label">
                          <Input
                            value={pin.linkLabel}
                            onChange={(e) => updatePin(index, { linkLabel: e.target.value })}
                            placeholder="Open"
                          />
                        </Field>
                        <Field label="Link URL">
                          <Input
                            value={pin.linkHref}
                            onChange={(e) => updatePin(index, { linkHref: e.target.value })}
                            placeholder="/contact or https://..."
                          />
                        </Field>
                      </div>
                      <Field label="Optional cover photo">
                        <PhotoPicker
                          photos={photos}
                          value={pin.photoId ?? null}
                          onChange={(photoId) => updatePin(index, { photoId })}
                          containerClassName="max-h-44"
                        />
                      </Field>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </SettingsGroup>
          </div>

          <div className="order-1">
            <SettingsGroup title="Map appearance">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Display mode">
                <Select
                  value={block.displayMode ?? "interactive"}
                  onChange={(e) => set({ displayMode: e.target.value as typeof block.displayMode })}
                >
                  <option value="interactive">Interactive marker map</option>
                  <option value="route-planning">Route planning map</option>
                  <option value="dotted-network">Dotted network map</option>
                </Select>
              </Field>
            </div>
            {(block.displayMode ?? "interactive") === "interactive" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Height">
                    <Select
                      value={block.height}
                      onChange={(e) => set({ height: e.target.value as typeof block.height })}
                    >
                      <option value="sm">Small</option>
                      <option value="md">Medium</option>
                      <option value="lg">Large</option>
                      <option value="screen">Almost full screen</option>
                    </Select>
                  </Field>
                  <Field label="Basemap style">
                    <Select
                      value={block.mapTheme}
                      onChange={(e) => set({ mapTheme: e.target.value as typeof block.mapTheme })}
                    >
                      <option value="auto">Auto light/dark</option>
                      <option value="light">Light Positron</option>
                      <option value="dark">Dark</option>
                      <option value="liberty">Liberty</option>
                      <option value="bright">Bright</option>
                    </Select>
                  </Field>
                  <Field label="Marker color">
                    <Input
                      type="color"
                      value={block.markerColor}
                      onChange={(e) => set({ markerColor: e.target.value })}
                    />
                  </Field>
                  <Field label="Popup behavior">
                    <Select
                      value={block.popupMode}
                      onChange={(e) => set({ popupMode: e.target.value as typeof block.popupMode })}
                    >
                      <option value="click">Click marker</option>
                      <option value="hover">Hover marker</option>
                    </Select>
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.showLabels}
                      onChange={(e) => set({ showLabels: e.target.checked })}
                    />
                    Show marker labels
                  </label>
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.showControls}
                      onChange={(e) => set({ showControls: e.target.checked })}
                    />
                    Show map controls
                  </label>
                </div>
              </>
            ) : (block.displayMode ?? "interactive") === "route-planning" ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Field label="Route style">
                    <Select
                      value={block.routeStyle ?? "planning"}
                      onChange={(e) => set({ routeStyle: e.target.value as typeof block.routeStyle })}
                    >
                      <option value="planning">Route planning</option>
                      <option value="basic">Basic numbered route</option>
                    </Select>
                  </Field>
                  <Field label="Height">
                    <Select
                      value={block.height}
                      onChange={(e) => set({ height: e.target.value as typeof block.height })}
                    >
                      <option value="sm">Small</option>
                      <option value="md">Medium</option>
                      <option value="lg">Large</option>
                      <option value="screen">Almost full screen</option>
                    </Select>
                  </Field>
                  <Field label="Basemap style">
                    <Select
                      value={block.mapTheme}
                      onChange={(e) => set({ mapTheme: e.target.value as typeof block.mapTheme })}
                    >
                      <option value="auto">Auto light/dark</option>
                      <option value="light">Light Positron</option>
                      <option value="dark">Dark</option>
                      <option value="liberty">Liberty</option>
                      <option value="bright">Bright</option>
                    </Select>
                  </Field>
                  <Field label="Route provider">
                    <Select
                      value={block.routeProvider ?? "osrm"}
                      onChange={(e) => set({ routeProvider: e.target.value as typeof block.routeProvider })}
                    >
                      <option value="osrm">OSRM route</option>
                      <option value="straight">Estimated path only</option>
                    </Select>
                  </Field>
                  <Field label="Travel mode">
                    <Select
                      value={block.routeTravelMode ?? "driving"}
                      onChange={(e) => set({ routeTravelMode: e.target.value as typeof block.routeTravelMode })}
                      disabled={(block.routeProvider ?? "osrm") !== "osrm"}
                    >
                      <option value="driving">Driving</option>
                      <option value="walking">Walking</option>
                      <option value="cycling">Cycling</option>
                    </Select>
                  </Field>
                </div>

                {(block.routeStyle ?? "planning") === "planning" ? (
                  <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
                    <Field label="Start point">
                      <Select
                        value={block.routeStartId ?? ""}
                        onChange={(e) => set({ routeStartId: e.target.value })}
                      >
                        <option value="">First mapped point</option>
                        {pointOptions.map((point) => (
                          <option key={point.id} value={point.id}>
                            {point.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="End point">
                      <Select
                        value={block.routeEndId ?? ""}
                        onChange={(e) => set({ routeEndId: e.target.value })}
                      >
                        <option value="">Last mapped point</option>
                        {pointOptions.map((point) => (
                          <option key={point.id} value={point.id}>
                            {point.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <div className="space-y-3 sm:col-span-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                          Stops between
                        </p>
                        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                          Add optional waypoints between the start and end.
                        </p>
                      </div>
                      {routePointIds.length > 0 && (
                        <div className="space-y-1.5">
                          {routePointIds.map((id, index) => (
                            <div
                              key={`${id}-${index}`}
                              className="flex items-center justify-between gap-2 rounded-md bg-[hsl(var(--muted))] px-2 py-1.5 text-sm"
                            >
                              <span className="min-w-0 truncate">
                                {index + 1}. {pointOptions.find((point) => point.id === id)?.label ?? "(removed)"}
                              </span>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={index === 0}
                                  onClick={() => set({ routePointIds: swapAt(routePointIds, index, index - 1) })}
                                  aria-label="Move stop up"
                                  className="h-8 w-8"
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={index === routePointIds.length - 1}
                                  onClick={() => set({ routePointIds: swapAt(routePointIds, index, index + 1) })}
                                  aria-label="Move stop down"
                                  className="h-8 w-8"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    set({ routePointIds: routePointIds.filter((_, stopIndex) => stopIndex !== index) })
                                  }
                                  aria-label="Remove stop"
                                  className="h-8 w-8"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {planningStopOptions.length > 0 ? (
                        <Select
                          value=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            set({ routePointIds: [...routePointIds, e.target.value] });
                          }}
                        >
                          <option value="">+ Add stop between...</option>
                          {planningStopOptions.map((point) => (
                            <option key={point.id} value={point.id}>
                              {point.label}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          Add more mapped locations or custom pins to use them as stops.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                          Route stops
                        </p>
                        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                          Leave blank to use every mapped point in order.
                        </p>
                      </div>
                    </div>
                    {routePointIds.length > 0 && (
                      <div className="space-y-1.5">
                        {routePointIds.map((id, index) => (
                          <div
                            key={`${id}-${index}`}
                            className="flex items-center justify-between gap-2 rounded-md bg-[hsl(var(--muted))] px-2 py-1.5 text-sm"
                          >
                            <span className="min-w-0 truncate">
                              {index + 1}. {pointOptions.find((point) => point.id === id)?.label ?? "(removed)"}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={index === 0}
                                onClick={() => set({ routePointIds: swapAt(routePointIds, index, index - 1) })}
                                aria-label="Move route stop up"
                                className="h-8 w-8"
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={index === routePointIds.length - 1}
                                onClick={() => set({ routePointIds: swapAt(routePointIds, index, index + 1) })}
                                aria-label="Move route stop down"
                                className="h-8 w-8"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  set({ routePointIds: routePointIds.filter((_, stopIndex) => stopIndex !== index) })
                                }
                                aria-label="Remove route stop"
                                className="h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {routeStopOptions.length > 0 && (
                      <Select
                        value=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          set({ routePointIds: [...routePointIds, e.target.value] });
                        }}
                      >
                        <option value="">+ Add route stop...</option>
                        {routeStopOptions.map((point) => (
                          <option key={point.id} value={point.id}>
                            {point.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Active route color">
                    <Input
                      type="color"
                      value={block.routeLineColor ?? "#6366f1"}
                      onChange={(e) => set({ routeLineColor: e.target.value })}
                    />
                  </Field>
                  <Field label="Other route color">
                    <Input
                      type="color"
                      value={block.routeInactiveLineColor ?? "#94a3b8"}
                      onChange={(e) => set({ routeInactiveLineColor: e.target.value })}
                    />
                  </Field>
                  <Field label="Start marker">
                    <Input
                      type="color"
                      value={block.routeStartColor ?? "#22c55e"}
                      onChange={(e) => set({ routeStartColor: e.target.value })}
                    />
                  </Field>
                  <Field label="End marker">
                    <Input
                      type="color"
                      value={block.routeEndColor ?? "#ef4444"}
                      onChange={(e) => set({ routeEndColor: e.target.value })}
                    />
                  </Field>
                  <Field label="Stop marker">
                    <Input
                      type="color"
                      value={block.markerColor}
                      onChange={(e) => set({ markerColor: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Summary position">
                    <Select
                      value={block.routeSummaryPosition ?? "top-left"}
                      onChange={(e) => set({ routeSummaryPosition: e.target.value as typeof block.routeSummaryPosition })}
                    >
                      <option value="top-left">Top left</option>
                      <option value="top-right">Top right</option>
                      <option value="bottom-left">Bottom left</option>
                      <option value="bottom-right">Bottom right</option>
                    </Select>
                  </Field>
                  <Field label="Summary style">
                    <Select
                      value={block.routeSummaryStyle ?? "solid"}
                      onChange={(e) => set({ routeSummaryStyle: e.target.value as typeof block.routeSummaryStyle })}
                    >
                      <option value="solid">Solid</option>
                      <option value="glass">Glass</option>
                      <option value="minimal">Minimal</option>
                    </Select>
                  </Field>
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.routeShowCards ?? true}
                      onChange={(e) => set({ routeShowCards: e.target.checked })}
                    />
                    Show route option buttons
                  </label>
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.routeShowStopList ?? true}
                      onChange={(e) => set({ routeShowStopList: e.target.checked })}
                    />
                    Show numbered stop list
                  </label>
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.routeShowMapLinks ?? true}
                      onChange={(e) => set({ routeShowMapLinks: e.target.checked })}
                    />
                    Show map app links
                  </label>
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.routeShowLabels ?? true}
                      onChange={(e) => set({ routeShowLabels: e.target.checked })}
                    />
                    Show point labels
                  </label>
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.showControls}
                      onChange={(e) => set({ showControls: e.target.checked })}
                    />
                    Show map controls
                  </label>
                  {(block.routeStyle ?? "planning") === "planning" && (
                    <label className="flex h-9 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={block.routeShowAlternatives ?? true}
                        onChange={(e) => set({ routeShowAlternatives: e.target.checked })}
                        disabled={(block.routeProvider ?? "osrm") !== "osrm"}
                      />
                      Show OSRM alternatives
                    </label>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Connection mode">
                    <Select
                      value={block.networkConnectionMode ?? "ordered"}
                      onChange={(e) =>
                        set({ networkConnectionMode: e.target.value as typeof block.networkConnectionMode })
                      }
                    >
                      <option value="ordered">Connect pins in order</option>
                      <option value="hub">First pin as hub</option>
                      <option value="manual">Manual connections</option>
                    </Select>
                  </Field>
                  <Field label="Line color">
                    <Input
                      type="color"
                      value={block.networkLineColor ?? "#0ea5e9"}
                      onChange={(e) => set({ networkLineColor: e.target.value })}
                    />
                  </Field>
                  <Field label="Pin color">
                    <Input
                      type="color"
                      value={block.networkDotColor ?? "#f43f5e"}
                      onChange={(e) => set({ networkDotColor: e.target.value })}
                    />
                  </Field>
                  <Field label="Map dot color">
                    <Input
                      type="color"
                      value={block.networkMapDotColor ?? "#94a3b8"}
                      onChange={(e) => set({ networkMapDotColor: e.target.value })}
                    />
                  </Field>
                  <Field label="Animation seconds">
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      step={0.1}
                      value={block.networkAnimationSeconds ?? 3.2}
                      onChange={(e) =>
                        set({
                          networkAnimationSeconds: Math.max(
                            1,
                            Math.min(12, Number(e.target.value) || 3.2),
                          ),
                        })
                      }
                    />
                  </Field>
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.networkShowLabels ?? true}
                      onChange={(e) => set({ networkShowLabels: e.target.checked })}
                    />
                    Show city labels
                  </label>
                </div>
                {(block.networkConnectionMode ?? "ordered") === "manual" && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                          Manual connections
                        </p>
                        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                          Choose which pins should be connected by animated arcs.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={pointOptions.length < 2}
                        onClick={() =>
                          set({
                            networkConnections: [
                              ...connections,
                              makeLocationMapConnection(pointOptions[0]?.id ?? "", pointOptions[1]?.id ?? ""),
                            ],
                          })
                        }
                      >
                        Add connection
                      </Button>
                    </div>
                    {pointOptions.length < 2 ? (
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        Add at least two mapped locations or custom pins to create a connection.
                      </p>
                    ) : connections.length === 0 ? (
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        No manual connections yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {connections.map((connection, index) => (
                          <div key={connection.id} className="grid gap-2 rounded-md bg-[hsl(var(--muted))]/55 p-2 sm:grid-cols-[1fr_1fr_auto]">
                            <Field label="From">
                              <Select
                                value={connection.startId}
                                onChange={(e) => updateConnection(index, { startId: e.target.value })}
                              >
                                {pointOptions.map((point) => (
                                  <option key={point.id} value={point.id}>
                                    {point.label}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <Field label="To">
                              <Select
                                value={connection.endId}
                                onChange={(e) => updateConnection(index, { endId: e.target.value })}
                              >
                                {pointOptions.map((point) => (
                                  <option key={point.id} value={point.id}>
                                    {point.label}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  set({
                                    networkConnections: connections.filter(
                                      (_, connectionIndex) => connectionIndex !== index,
                                    ),
                                  })
                                }
                                aria-label="Remove connection"
                                className="h-9 w-9"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            </SettingsGroup>
          </div>
        </div>
      );
    }
    case "scrollShowcase": {
      const cats = targets.category ?? [];
      // Blocks created before categoryIds existed (or via raw inserts) won't have
      // it — the editor loads stored blocks without applying schema defaults.
      const chosen = block.categoryIds ?? [];
      const unchosen = cats.filter((c) => !chosen.includes(c.id));
      const labelOf = (cid: string) => cats.find((c) => c.id === cid)?.label ?? "(removed)";
      const photoCountOf = (cid: string) => cats.find((c) => c.id === cid)?.photoCount ?? 0;
      const categoryOptionLabel = (c: Opt) =>
        `${c.label} (${c.photoCount ?? 0} ${(c.photoCount ?? 0) === 1 ? "photo" : "photos"})`;
      const auto = chosen.length === 0;
      const isScrollPanels = block.style === "scrollPanels";
      const isLayoutFormations = block.style === "layoutFormations";
      const isScrollLayouts = block.style === "scrollLayouts";
      const useScrollPanelsBackground = block.scrollPanelsUseBackground ?? true;
      const useScrollLayoutsBackground = block.scrollLayoutsUseBackground ?? true;
      const layoutFormationVariant = block.layoutFormationsVariant ?? "rise";
      const layoutFormationPhotoOptions =
        layoutFormationVariant === "zoomed" ? [9] : [6, 9, 12, 18, 24];
      const storedLayoutFormationPhotoCount =
        block.layoutFormationsPhotoCount === 17
          ? 18
          : (block.layoutFormationsPhotoCount ?? 12);
      const layoutFormationPhotoCount =
        layoutFormationVariant === "zoomed"
          ? 9
          : storedLayoutFormationPhotoCount;
      const scrollLayoutsVariant = block.scrollLayoutsVariant ?? "row";
      const scrollLayoutsFixedCounts: Record<string, number> = {
        row: 7,
        breakout: 9,
        grid10: 16,
        stackDark: 6,
        stackGlass: 6,
        stackScale: 6,
        bento: 8,
        single: 1,
      };
      const scrollLayoutsPhotoOptions =
        scrollLayoutsVariant === "tiny"
          ? [24, 36, 60, 80]
          : [scrollLayoutsFixedCounts[scrollLayoutsVariant] ?? 9];
      const scrollLayoutsPhotoCount =
        scrollLayoutsVariant === "tiny"
          ? (block.scrollLayoutsPhotoCount ?? 80)
          : scrollLayoutsPhotoOptions[0];
      return (
        <div className="space-y-3">
          <SettingsGroup
            title="Style"
            description="Choose the animation family first. The controls below change to match that style."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Showcase style">
                <Select value={block.style ?? "cinematic"} onChange={(e) => set({ style: e.target.value as typeof block.style })}>
                  <option value="cinematic">Cinematic wipe</option>
                  <option value="carousel3d">3D carousel (on scroll)</option>
                  <option value="scrollPanels">Scroll panels</option>
                  <option value="layoutFormations">Layout formations</option>
                  <option value="scrollLayouts">Scroll layout morphs</option>
                </Select>
              </Field>
              <Field label="Category title display">
                <Select value={block.showTitles ? "yes" : "no"} onChange={(e) => set({ showTitles: e.target.value === "yes" })}>
                  <option value="yes">Show category names</option>
                  <option value="no">Hide category names</option>
                </Select>
              </Field>
              {auto && (
                <Field label="Max categories">
                  <Select value={String(block.limit)} onChange={(e) => set({ limit: Number(e.target.value) })}>
                    {[3, 4, 5, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}
                  </Select>
                </Field>
              )}
            </div>
          </SettingsGroup>

          {isScrollPanels ? (
            <>
              <SettingsGroup
                title="Intro text"
                description="Text shown before the collection rows rise over the intro photos."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Top label">
                    <Input
                      value={block.title}
                      onChange={(e) => set({ title: e.target.value })}
                      placeholder="Selected work"
                    />
                  </Field>
                  <Field label="Text position">
                    <Select
                      value={block.scrollPanelsIntroAlign ?? "left"}
                      onChange={(e) => set({ scrollPanelsIntroAlign: e.target.value as typeof block.scrollPanelsIntroAlign })}
                    >
                      <option value="left">Left side</option>
                      <option value="center">Middle</option>
                      <option value="right">Right side</option>
                    </Select>
                  </Field>
                  <Field label="Main heading">
                    <Textarea
                      rows={2}
                      value={block.scrollPanelsIntroHeading ?? "Selected Stories"}
                      onChange={(e) => set({ scrollPanelsIntroHeading: e.target.value })}
                    />
                  </Field>
                  <Field label="Supporting text">
                    <Textarea
                      rows={3}
                      value={
                        block.scrollPanelsIntroText ??
                        "Scroll through featured collections, places, and small visual fragments from the archive."
                      }
                      onChange={(e) => set({ scrollPanelsIntroText: e.target.value })}
                    />
                  </Field>
                  <Field label="Collection heading">
                    <Textarea
                      rows={2}
                      value={block.scrollPanelsShowcaseHeading ?? "Selected Work"}
                      onChange={(e) => set({ scrollPanelsShowcaseHeading: e.target.value })}
                    />
                  </Field>
                </div>
              </SettingsGroup>

              <SettingsGroup
                title="Scroll panels layout"
                description="Controls the intro photo treatment and the category rows below it."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Demo variant">
                    <Select
                      value={
                        block.scrollPanelsVariant === "zoom" || block.scrollPanelsVariant === "brightness"
                          ? "demo4"
                          : block.scrollPanelsVariant ?? "classic"
                      }
                      onChange={(e) => set({ scrollPanelsVariant: e.target.value as typeof block.scrollPanelsVariant })}
                    >
                      <option value="classic">Classic columns</option>
                      <option value="scatter">Scatter outward</option>
                      <option value="demo4">Angled rows</option>
                      <option value="perspective">Perspective blur</option>
                    </Select>
                  </Field>
                  <Field label="Intro photo count">
                    <Select
                      value={String(block.scrollPanelsIntroCount ?? 12)}
                      onChange={(e) => set({ scrollPanelsIntroCount: Number(e.target.value) })}
                    >
                      {[6, 9, 12, 15, 18, 21, 24].map((n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  </Field>
                  <Field label="Photos per collection row">
                    <Select
                      value={String(block.scrollPanelsRowCount ?? 5)}
                      onChange={(e) => set({ scrollPanelsRowCount: Number(e.target.value) })}
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  </Field>
                  <Field label="Photo tone">
                    <Select
                      value={block.scrollPanelsTone ?? "color"}
                      onChange={(e) => set({ scrollPanelsTone: e.target.value as typeof block.scrollPanelsTone })}
                    >
                      <option value="color">Full color</option>
                      <option value="grayscale">Reveal from black and white</option>
                    </Select>
                  </Field>
                </div>
              </SettingsGroup>

              <SettingsGroup
                title="Colors"
                description="Use custom colors for this block, or let the page theme decide."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Background mode">
                    <Select
                      value={useScrollPanelsBackground ? "yes" : "no"}
                      onChange={(e) => set({ scrollPanelsUseBackground: e.target.value === "yes" })}
                    >
                      <option value="yes">Use custom background</option>
                      <option value="no">Use page background</option>
                    </Select>
                  </Field>
                  {useScrollPanelsBackground && (
                    <>
                      <Field label="Background color">
                        <Input
                          type="color"
                          value={block.scrollPanelsBackground ?? "#f4f0e8"}
                          onChange={(e) => set({ scrollPanelsBackground: e.target.value })}
                          className="h-10 p-1"
                        />
                      </Field>
                      <Field label="Text color">
                        <Input
                          type="color"
                          value={block.scrollPanelsTextColor ?? "#171717"}
                          onChange={(e) => set({ scrollPanelsTextColor: e.target.value })}
                          className="h-10 p-1"
                        />
                      </Field>
                    </>
                  )}
                </div>
              </SettingsGroup>
            </>
          ) : isLayoutFormations ? (
            <>
              <SettingsGroup
                title="Top text"
                description="Text shown above the first animated formation grid."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Eyebrow">
                    <Input
                      value={block.title}
                      onChange={(e) => set({ title: e.target.value })}
                      placeholder="Selected work"
                    />
                  </Field>
                  <Field label="Top heading">
                    <Input
                      value={block.layoutFormationsHeading ?? "Layout formations"}
                      onChange={(e) => set({ layoutFormationsHeading: e.target.value })}
                      placeholder="Layout formations"
                    />
                  </Field>
                  <Field label="Text position">
                    <Select
                      value={block.layoutFormationsHeaderAlign ?? "left"}
                      onChange={(e) =>
                        set({
                          layoutFormationsHeaderAlign:
                            e.target.value as typeof block.layoutFormationsHeaderAlign,
                        })
                      }
                    >
                      <option value="left">Left side</option>
                      <option value="center">Center</option>
                      <option value="right">Right side</option>
                    </Select>
                  </Field>
                </div>
              </SettingsGroup>

              <SettingsGroup
                title="Formation layout"
                description="Choose the animation pattern and how many photos each category formation uses."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Formation variant">
                    <Select
                      value={layoutFormationVariant}
                      onChange={(e) => {
                        const nextVariant =
                          e.target.value as typeof block.layoutFormationsVariant;
                        set({
                          layoutFormationsVariant: nextVariant,
                          ...(nextVariant === "zoomed"
                            ? { layoutFormationsPhotoCount: 9 }
                            : {}),
                        });
                      }}
                    >
                      <option value="rise">Rise grid</option>
                      <option value="columns">Column assemble</option>
                      <option value="zoomed">Zoomed grid</option>
                      <option value="reveal">Column reveal</option>
                      <option value="tilted">Tilted fly-in</option>
                      <option value="depth">3D depth fly-in</option>
                      <option value="sidePivot">Side pivot</option>
                    </Select>
                  </Field>
                  <Field label="Photos per formation">
                    <Select
                      value={String(layoutFormationPhotoCount)}
                      onChange={(e) =>
                        set({ layoutFormationsPhotoCount: Number(e.target.value) })
                      }
                    >
                      {layoutFormationPhotoOptions.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </SettingsGroup>
            </>
          ) : isScrollLayouts ? (
            <>
              <SettingsGroup
                title="Intro text"
                description="Text shown before the pinned image layout transitions."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Top label">
                    <Input
                      value={block.title}
                      onChange={(e) => set({ title: e.target.value })}
                      placeholder="Selected work"
                    />
                  </Field>
                  <Field label="Main heading">
                    <Input
                      value={block.scrollLayoutsHeading ?? "Scroll layout morphs"}
                      onChange={(e) => set({ scrollLayoutsHeading: e.target.value })}
                      placeholder="Scroll layout morphs"
                    />
                  </Field>
                  <Field label="Supporting text">
                    <Textarea
                      rows={3}
                      value={
                        block.scrollLayoutsIntroText ??
                        "Pinned image layouts morph between editorial compositions as you scroll."
                      }
                      onChange={(e) => set({ scrollLayoutsIntroText: e.target.value })}
                    />
                  </Field>
                </div>
              </SettingsGroup>

              <SettingsGroup
                title="Layout morph"
                description="Codrops ScrollBasedLayoutAnimations-style pinned image layout transitions."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Demo variant">
                    <Select
                      value={scrollLayoutsVariant}
                      onChange={(e) => {
                        const nextVariant = e.target.value as typeof block.scrollLayoutsVariant;
                        const fixedCounts: Record<string, number> = {
                          row: 7,
                          breakout: 9,
                          grid10: 16,
                          stackDark: 6,
                          stackGlass: 6,
                          stackScale: 6,
                          bento: 8,
                          single: 1,
                        };
                        set({
                          scrollLayoutsVariant: nextVariant,
                          scrollLayoutsPhotoCount:
                            nextVariant === "tiny" ? 80 : fixedCounts[nextVariant ?? "row"] ?? 9,
                        });
                      }}
                    >
                      <option value="row">Row focus</option>
                      <option value="breakout">Breakout grid</option>
                      <option value="grid10">Long grid</option>
                      <option value="stackDark">Dark stack</option>
                      <option value="stackGlass">Glass stack</option>
                      <option value="stackScale">Scale stack</option>
                      <option value="tiny">Tiny grid</option>
                      <option value="bento">Bento spread</option>
                      <option value="single">Single image reveal</option>
                    </Select>
                  </Field>
                  <Field label="Photos per layout">
                    <Select
                      value={String(scrollLayoutsPhotoCount)}
                      onChange={(e) => set({ scrollLayoutsPhotoCount: Number(e.target.value) })}
                    >
                      {scrollLayoutsPhotoOptions.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Caption">
                    <Textarea
                      rows={3}
                      value={block.scrollLayoutsCaption ?? ""}
                      onChange={(e) => set({ scrollLayoutsCaption: e.target.value })}
                      placeholder="Leave blank to use the category name."
                    />
                  </Field>
                </div>
              </SettingsGroup>

              <SettingsGroup
                title="Colors"
                description="Use the dark Codrops-style background or let the page theme decide."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Background mode">
                    <Select
                      value={useScrollLayoutsBackground ? "yes" : "no"}
                      onChange={(e) => set({ scrollLayoutsUseBackground: e.target.value === "yes" })}
                    >
                      <option value="yes">Use custom background</option>
                      <option value="no">Use page background</option>
                    </Select>
                  </Field>
                  {useScrollLayoutsBackground && (
                    <>
                      <Field label="Background color">
                        <Input
                          type="color"
                          value={block.scrollLayoutsBackground ?? "#131417"}
                          onChange={(e) => set({ scrollLayoutsBackground: e.target.value })}
                          className="h-10 p-1"
                        />
                      </Field>
                      <Field label="Text color">
                        <Input
                          type="color"
                          value={block.scrollLayoutsTextColor ?? "#ffffff"}
                          onChange={(e) => set({ scrollLayoutsTextColor: e.target.value })}
                          className="h-10 p-1"
                        />
                      </Field>
                    </>
                  )}
                </div>
              </SettingsGroup>
            </>
          ) : (
            <SettingsGroup
              title={block.style === "carousel3d" ? "3D carousel content" : "Cinematic panel content"}
              description="These styles use each category as a scroll-driven panel."
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Eyebrow">
                  <Input
                    value={block.title}
                    onChange={(e) => set({ title: e.target.value })}
                    placeholder="Selected work"
                  />
                </Field>
                <Field label="Images per panel">
                  <Select value={String(block.clusterCount)} onChange={(e) => set({ clusterCount: Number(e.target.value) })}>
                    <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
                  </Select>
                </Field>
              </div>
            </SettingsGroup>
          )}

          <SettingsGroup
            title="Categories"
            description="Choose the categories and order used by this showcase. Empty means automatic."
          >
            <Field label="Categories to show">
              <div className="space-y-1.5">
                {chosen.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Showing all published categories automatically, up to the max category count.
                  </p>
                ) : (
                  chosen.map((cid, i) => (
                    <div key={cid} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5">
                      <span className="truncate text-sm">
                        {i + 1}. {labelOf(cid)}
                        <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">
                          ({photoCountOf(cid)} {photoCountOf(cid) === 1 ? "photo" : "photos"})
                        </span>
                      </span>
                      <div className="flex items-center gap-0.5 text-[hsl(var(--muted-foreground))]">
                        <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => set({ categoryIds: swapAt(chosen, i, i - 1) })} className="p-0.5 hover:text-[hsl(var(--foreground))] disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label="Move down" disabled={i === chosen.length - 1} onClick={() => set({ categoryIds: swapAt(chosen, i, i + 1) })} className="p-0.5 hover:text-[hsl(var(--foreground))] disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label="Remove" onClick={() => set({ categoryIds: chosen.filter((x) => x !== cid) })} className="p-0.5 hover:text-[hsl(var(--foreground))]"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  ))
                )}
                {unchosen.length > 0 && (
                  <Select value="" onChange={(e) => e.target.value && set({ categoryIds: [...chosen, e.target.value] })}>
                    <option value="">＋ Add category…</option>
                    {unchosen.map((c) => <option key={c.id} value={c.id}>{categoryOptionLabel(c)}</option>)}
                  </Select>
                )}
              </div>
            </Field>
          </SettingsGroup>

          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Each category becomes a full-screen panel or formation using its photos and name. Categories with no photos are skipped. Manage covers + which categories are published in{" "}
            <Link href="/admin/categories" className="underline underline-offset-2">Categories</Link>.
          </p>
        </div>
      );
    }
    case "instagram":
      return (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Title"><Input value={block.title} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="Count"><Input type="number" value={block.count} onChange={(e) => set({ count: Number(e.target.value) })} /></Field>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Shows your Instagram feed once connected in{" "}
            <Link href="/admin/settings" className="underline underline-offset-2">Settings → Integrations</Link>.
            Until then it falls back to your most recent library photos.
          </p>
        </div>
      );
    case "faq":
      return (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Title (optional)"><Input value={block.title ?? ""} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="Style">
              <Select value={block.style} onChange={(e) => set({ style: e.target.value as typeof block.style })}>
                <option value="accordion">Accordion</option>
                <option value="list">List</option>
                <option value="cards">Cards</option>
                <option value="bordered">Bordered</option>
              </Select>
            </Field>
            <AlignField value={block.align} onChange={(align) => set({ align })} />
          </div>
          <div className="space-y-2">
            {block.items.map((it, i) => (
              <div key={i} className="space-y-1.5 rounded border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Q{i + 1}</span>
                  <div className="flex items-center gap-0.5 text-[hsl(var(--muted-foreground))]">
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => set({ items: swapAt(block.items, i, i - 1) })} className="p-0.5 hover:text-[hsl(var(--foreground))] disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Move down" disabled={i === block.items.length - 1} onClick={() => set({ items: swapAt(block.items, i, i + 1) })} className="p-0.5 hover:text-[hsl(var(--foreground))] disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Remove" onClick={() => set({ items: block.items.filter((_, k) => k !== i) })} className="p-0.5 hover:text-[hsl(var(--foreground))]"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
                <Input placeholder="Question" value={it.q} onChange={(e) => set({ items: block.items.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)) })} />
                <Textarea rows={2} placeholder="Answer" value={it.a} onChange={(e) => set({ items: block.items.map((x, k) => (k === i ? { ...x, a: e.target.value } : x)) })} />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => set({ items: [...block.items, { q: "", a: "" }] })}>
              <Plus className="h-4 w-4" /> Question
            </Button>
          </div>
        </div>
      );
    case "logos": {
      const isToraClientWall = block.style === "tora-client-wall";
      const updateLogoStyle = (style: typeof block.style) => {
        const patch: Partial<LeafBlock> = { style };
        if (style === "tora-client-wall") {
          if (!block.title?.trim() || block.title === "As featured in") {
            patch.title = TORA_CLIENT_WALL_DEFAULT_TITLE;
          }
          if (!(block.eyebrow ?? "").trim()) {
            patch.eyebrow = TORA_CLIENT_WALL_DEFAULT_EYEBROW;
          }
          if (!(block.intro ?? "").trim()) {
            patch.intro = TORA_CLIENT_WALL_DEFAULT_INTRO;
          }
          patch.size = "md";
          patch.spacing = "normal";
        }
        set(patch);
      };
      return (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={isToraClientWall ? "Heading" : "Title (optional)"}><Input value={block.title ?? ""} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="Style">
              <Select value={block.style} onChange={(e) => updateLogoStyle(e.target.value as typeof block.style)}>
                <option value="row">Row</option>
                <option value="grid">Grid</option>
                <option value="marquee">Marquee (scrolling)</option>
                <option value="tora-client-wall">Tora client wall</option>
              </Select>
            </Field>
            {isToraClientWall && (
              <>
                <Field label="Small label"><Input value={block.eyebrow ?? ""} onChange={(e) => set({ eyebrow: e.target.value })} /></Field>
                <div className="sm:col-span-2">
                  <Field label="Intro text">
                    <Textarea rows={3} value={block.intro ?? ""} onChange={(e) => set({ intro: e.target.value })} />
                  </Field>
                </div>
              </>
            )}
            {!isToraClientWall && (
              <>
                <Field label="Size">
                  <Select value={block.size} onChange={(e) => set({ size: e.target.value as typeof block.size })}>
                    <option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option>
                  </Select>
                </Field>
                <Field label="Spacing">
                  <Select value={block.spacing ?? "normal"} onChange={(e) => set({ spacing: e.target.value as typeof block.spacing })}>
                    <option value="tighter">Tighter</option><option value="tight">Tight</option><option value="normal">Normal</option><option value="airy">Airy</option>
                  </Select>
                </Field>
              </>
            )}
            <Field label="Color">
              <Select value={block.grayscale ? "mono" : "color"} onChange={(e) => set({ grayscale: e.target.value === "mono" })}>
                <option value="mono">Grayscale (color on hover)</option>
                <option value="color">Full color</option>
              </Select>
            </Field>
          </div>
          <Field label="Logos — click to add/remove (from your library)">
            <PhotoPicker
              photos={photos}
              selectedIds={block.photoIds}
              onToggle={(pid) => set({ photoIds: block.photoIds.includes(pid) ? block.photoIds.filter((x) => x !== pid) : [...block.photoIds, pid] })}
            />
          </Field>
        </div>
      );
    }
    case "divider":
      return (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Style">
              <Select
                value={block.style ?? "solid"}
                onChange={(e) =>
                  set({ style: e.target.value as typeof block.style })
                }
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
                <option value="double">Double</option>
                <option value="fade">Fade</option>
                <option value="gradient">Gradient</option>
              </Select>
            </Field>
            <Field label="Thickness">
              <Select
                value={block.thickness ?? "hairline"}
                onChange={(e) =>
                  set({ thickness: e.target.value as typeof block.thickness })
                }
              >
                <option value="hairline">Hairline</option>
                <option value="thin">Thin</option>
                <option value="medium">Medium</option>
                <option value="thick">Thick</option>
              </Select>
            </Field>
            <Field label="Width">
              <Select
                value={block.width ?? "content"}
                onChange={(e) =>
                  set({ width: e.target.value as typeof block.width })
                }
              >
                <option value="content">Content</option>
                <option value="narrow">Narrow</option>
                <option value="full">Full page</option>
              </Select>
            </Field>
            {(block.width ?? "content") !== "full" && (
              <AlignField
                value={block.align ?? "center"}
                onChange={(align) => set({ align })}
              />
            )}
            <Field label="Spacing">
              <Select
                value={block.spacing ?? "normal"}
                onChange={(e) =>
                  set({ spacing: e.target.value as typeof block.spacing })
                }
              >
                <option value="tight">Tight</option>
                <option value="normal">Normal</option>
                <option value="airy">Airy</option>
                <option value="custom">Custom</option>
              </Select>
            </Field>
            {(block.spacing ?? "normal") === "custom" && (
              <>
                <Field label="Space above">
                  <Input
                    type="number"
                    min={0}
                    max={240}
                    value={block.customSpacingTop ?? 32}
                    onChange={(e) =>
                      set({ customSpacingTop: pxInput(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Space below">
                  <Input
                    type="number"
                    min={0}
                    max={240}
                    value={block.customSpacingBottom ?? 32}
                    onChange={(e) =>
                      set({ customSpacingBottom: pxInput(e.target.value) })
                    }
                  />
                </Field>
              </>
            )}
          </div>
          <Field label="Label text">
            <Input
              value={block.label ?? ""}
              onChange={(e) => set({ label: e.target.value })}
              placeholder="Optional"
            />
          </Field>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Line color">
              <Select
                value={block.colorMode ?? "border"}
                onChange={(e) =>
                  set({ colorMode: e.target.value as typeof block.colorMode })
                }
              >
                <option value="border">Theme border</option>
                <option value="muted">Theme muted text</option>
                <option value="foreground">Theme foreground</option>
                <option value="custom">Custom color</option>
              </Select>
            </Field>
            {(block.colorMode ?? "border") === "custom" && (
              <Field label="Custom line color">
                <Input
                  type="color"
                  value={block.color ?? "#d4d4d8"}
                  onChange={(e) => set({ color: e.target.value })}
                />
              </Field>
            )}
            <Field label="Background">
              <Select
                value={block.backgroundMode ?? "none"}
                onChange={(e) =>
                  set({
                    backgroundMode: e.target.value as typeof block.backgroundMode,
                  })
                }
              >
                <option value="none">No background</option>
                <option value="muted">Theme muted</option>
                <option value="custom">Custom color</option>
              </Select>
            </Field>
            {(block.backgroundMode ?? "none") === "custom" && (
              <Field label="Background color">
                <Input
                  type="color"
                  value={block.backgroundColor ?? "#f4f4f5"}
                  onChange={(e) => set({ backgroundColor: e.target.value })}
                />
              </Field>
            )}
          </div>
        </div>
      );
    default:
      return null;
  }
}

function AlignField({ value, onChange }: { value: "left" | "center" | "right"; onChange: (v: "left" | "center" | "right") => void }) {
  return (
    <Field label="Align">
      <Select value={value} onChange={(e) => onChange(e.target.value as "left" | "center" | "right")}>
        <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
      </Select>
    </Field>
  );
}

type FontValue = "sans" | "serif" | "playfair" | "cormorant" | "montserrat" | "grotesk";
function FontField({ value, onChange }: { value: FontValue; onChange: (v: FontValue) => void }) {
  return (
    <Field label="Font">
      <Select value={value} onChange={(e) => onChange(e.target.value as FontValue)}>
        <option value="sans">Sans</option>
        <option value="serif">Serif</option>
        <option value="playfair">Playfair Display</option>
        <option value="cormorant">Cormorant</option>
        <option value="montserrat">Montserrat</option>
        <option value="grotesk">Space Grotesk</option>
      </Select>
    </Field>
  );
}

type SpaceValue = "tight" | "normal" | "airy";
function SpacingField({ value, onChange }: { value: SpaceValue; onChange: (v: SpaceValue) => void }) {
  return (
    <Field label="Spacing">
      <Select value={value} onChange={(e) => onChange(e.target.value as SpaceValue)}>
        <option value="tight">Tight</option><option value="normal">Normal</option><option value="airy">Airy</option>
      </Select>
    </Field>
  );
}

function PreviewPane({
  id,
  blocks,
  theme,
  slug,
}: {
  id: string;
  blocks: Block[];
  theme: "light" | "dark" | "auto" | null;
  slug: string;
}) {
  const { toast } = useToast();
  const [device, setDevice] = useState<"desktop" | "mobile">(() => {
    if (typeof window === "undefined") return "desktop";
    return window.matchMedia("(max-width: 767px)").matches
      ? "mobile"
      : "desktop";
  });
  const [manualDevice, setManualDevice] = useState(false);
  const [bust, setBust] = useState(0);

  // Preserve the preview's scroll position across reloads (each draft push busts
  // the iframe src). Track scroll into a ref; restore it once the new doc loads.
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const scrollRef = useRef(0);
  const onPreviewScroll = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (win) scrollRef.current = win.scrollY;
  }, []);
  const handlePreviewLoad = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.scrollTo(0, scrollRef.current);
    win.removeEventListener("scroll", onPreviewScroll);
    win.addEventListener("scroll", onPreviewScroll, { passive: true });
  }, [onPreviewScroll]);

  // Measure the available pane width so the desktop preview can render at a real
  // desktop width (so md: breakpoints apply — columns sit side by side) and be
  // scaled to fit, instead of rendering narrow (where everything stacks).
  const paneRef = useRef<HTMLDivElement>(null);
  const [paneWidth, setPaneWidth] = useState(0);
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const update = () => setPaneWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (manualDevice) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setDevice(mq.matches ? "mobile" : "desktop");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [manualDevice]);

  const pushDraft = useCallback(async () => {
    try {
      await api.post(`/api/v1/admin/pages/${id}/preview`, { blocks, theme });
      setBust((n) => n + 1);
    } catch (err) {
      toast(errMsg(err), "error");
    }
  }, [id, blocks, theme, toast]);

  // Debounced: push the draft + refresh whenever blocks/theme change.
  useEffect(() => {
    const t = setTimeout(() => {
      void pushDraft();
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, theme]);

  const src = useMemo(() => {
    const params = new URLSearchParams();
    params.set("v", String(bust));
    if (theme === "light" || theme === "dark") params.set("__theme", theme);
    params.set("__previewFrame", "1");
    return `/preview/page/${id}?${params.toString()}`;
  }, [id, bust, theme]);

  return (
    <div className="min-w-0 space-y-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Live preview</span>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button
            type="button"
            variant={device === "desktop" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setManualDevice(true);
              setDevice("desktop");
            }}
            aria-label="Desktop"
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={device === "mobile" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setManualDevice(true);
              setDevice("mobile");
            }}
            aria-label="Mobile"
          >
            <Smartphone className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={pushDraft} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <a href={`/${slug}`} target="_blank" rel="noreferrer noopener" className="inline-flex h-8 items-center rounded-md border px-2 text-xs">
            <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
          </a>
        </div>
      </div>
      <div ref={paneRef} className="min-w-0 overflow-hidden rounded-lg border bg-[hsl(var(--muted))] lg:flex-none">
        {(() => {
          const baseW = device === "mobile" ? 390 : 1440;
          const baseH = device === "mobile" ? 844 : 900;
          const scale = paneWidth > 0 ? Math.min(1, paneWidth / baseW) : 1;
          const visH = device === "mobile" ? baseH * scale : Math.min(640, baseH * scale);
          return (
            <div className="mx-auto" style={{ width: baseW * scale, height: visH }}>
              <iframe
                ref={iframeRef}
                onLoad={handlePreviewLoad}
                id="page-preview-iframe"
                key={`${device}-${bust}`}
                src={src}
                title="Page preview"
                className="border-0 bg-[hsl(var(--background))]"
                style={{
                  width: baseW,
                  height: baseH,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
                sandbox="allow-same-origin allow-scripts allow-popups"
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
