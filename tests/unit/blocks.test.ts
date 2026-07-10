import { describe, expect, it } from "vitest";
import { collectPhotoIds, parseBlocks } from "@/src/lib/blocks";
import { presetBlocks } from "@/src/lib/page-presets";

describe("page builder blocks", () => {
  it("keeps and defaults contact form blocks", () => {
    const blocks = parseBlocks([
      {
        id: "contact",
        type: "contactForm",
        style: "tora-contact",
        heading: "Start here",
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "contact",
      type: "contactForm",
      style: "tora-contact",
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

  it("keeps and defaults shop blocks", () => {
    const blocks = parseBlocks([
      {
        id: "shop",
        type: "shop",
        style: "tora-grid",
        source: "featured",
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "shop",
      type: "shop",
      style: "tora-grid",
      source: "featured",
      title: "SHOP",
      limit: 12,
      showSidebar: true,
      showSaleBadge: true,
      theme: "auto",
    });
  });

  it("keeps and defaults the justified showcase blurred side fill", () => {
    const blocks = parseBlocks([
      {
        id: "gallery-default",
        type: "gallery",
        gridType: "tora-justified-showcase",
      },
      {
        id: "gallery-plain-lead",
        type: "gallery",
        gridType: "tora-justified-showcase",
        toraJustifiedShowBlurredSideFill: false,
      },
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      toraJustifiedShowBlurredSideFill: true,
    });
    expect(blocks[1]).toMatchObject({
      toraJustifiedShowBlurredSideFill: false,
    });
  });

  it("keeps Tora client wall logo blocks", () => {
    const blocks = parseBlocks([
      {
        id: "logos",
        type: "logos",
        title: "OUR HAPPY CLIENTS",
        eyebrow: "BEST CASES",
        intro: "A short client wall introduction.",
        style: "tora-client-wall",
        grayscale: false,
        photoIds: ["logo-a", "logo-b"],
      },
      {
        id: "logos-defaults",
        type: "logos",
        style: "tora-client-wall",
        photoIds: ["logo-c"],
      },
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      id: "logos",
      type: "logos",
      title: "OUR HAPPY CLIENTS",
      eyebrow: "BEST CASES",
      intro: "A short client wall introduction.",
      style: "tora-client-wall",
      grayscale: false,
    });
    expect(blocks[1]).toMatchObject({
      id: "logos-defaults",
      type: "logos",
      eyebrow: "BEST CASES",
      intro: "",
      style: "tora-client-wall",
      grayscale: true,
    });
    expect(collectPhotoIds(blocks)).toEqual(["logo-a", "logo-b", "logo-c"]);
  });

  it("keeps Tora info blocks with tabs, accordion rows, and photo refs", () => {
    const blocks = parseBlocks([
      {
        id: "info",
        type: "infoBlock",
        style: "tabs",
        eyebrow: "WHAT I LOVE TO SHOOT",
        title: "COLLABORATION",
        text: "Intro copy.",
        quote: "Quote copy.",
        photoId: "lead-photo",
        secondaryPhotoId: "signature-photo",
        dimPhoto: false,
        buttonLabel: "LET'S CONNECT",
        buttonHref: "/contact",
        tabs: [
          {
            id: "tab-a",
            title: "COMMERCIAL",
            text: "Commercial copy.",
            photoId: "tab-photo-a",
            accentPhotoId: "tab-accent-a",
          },
          {
            id: "tab-b",
            title: "PERSONAL",
            text: "Personal copy.",
            photoId: "tab-photo-b",
            accentPhotoId: null,
          },
        ],
        accordionItems: [
          {
            id: "row-a",
            title: "DESCRIPTION",
            text: "Accordion copy.",
          },
        ],
      },
      {
        id: "info-defaults",
        type: "infoBlock",
      },
      {
        id: "info-reference",
        type: "infoBlock",
        style: "infoListReference",
        photoId: "reference-photo",
        dimPhoto: false,
      },
      {
        id: "info-creative-options",
        type: "infoBlock",
        style: "creative",
        creativeTextLayout: "reference",
        creativePhotoSize: "70",
        photoId: "creative-photo",
        dimPhoto: false,
      },
      {
        id: "info-list-options",
        type: "infoBlock",
        style: "infoList",
        infoListTextPosition: "center",
        photoId: "list-photo",
        dimPhoto: true,
      },
    ]);

    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toMatchObject({
      id: "info",
      type: "infoBlock",
      style: "tabs",
      eyebrow: "WHAT I LOVE TO SHOOT",
      dimPhoto: false,
      buttonHref: "/contact",
      tabs: [
        {
          id: "tab-a",
          title: "COMMERCIAL",
          photoId: "tab-photo-a",
          accentPhotoId: "tab-accent-a",
        },
        {
          id: "tab-b",
          title: "PERSONAL",
          photoId: "tab-photo-b",
          accentPhotoId: null,
        },
      ],
      accordionItems: [
        {
          id: "row-a",
          title: "DESCRIPTION",
        },
      ],
    });
    expect(blocks[1]).toMatchObject({
      id: "info-defaults",
      type: "infoBlock",
      style: "creative",
      tabs: [],
      accordionItems: [],
      dimPhoto: true,
      creativeTextLayout: "split",
      creativePhotoSize: "60",
      infoListTextPosition: "left",
    });
    expect(blocks[2]).toMatchObject({
      id: "info-reference",
      type: "infoBlock",
      style: "infoListReference",
      photoId: "reference-photo",
      dimPhoto: false,
    });
    expect(blocks[3]).toMatchObject({
      id: "info-creative-options",
      type: "infoBlock",
      style: "creative",
      creativeTextLayout: "reference",
      creativePhotoSize: "70",
      photoId: "creative-photo",
      dimPhoto: false,
    });
    expect(blocks[4]).toMatchObject({
      id: "info-list-options",
      type: "infoBlock",
      style: "infoList",
      infoListTextPosition: "center",
      photoId: "list-photo",
      dimPhoto: true,
    });
    expect(collectPhotoIds(blocks)).toEqual([
      "lead-photo",
      "signature-photo",
      "tab-photo-a",
      "tab-accent-a",
      "tab-photo-b",
      "reference-photo",
      "creative-photo",
      "list-photo",
    ]);
  });

  it("keeps location map blocks with selected locations", () => {
    const blocks = parseBlocks([
      {
        id: "map",
        type: "locationMap",
        title: "Field notes",
        subtitle: "Places with work nearby.",
        locationIds: ["loc-a", "loc-b"],
        customPins: [
          {
            id: "pin-a",
            title: "Ceremony overlook",
            subtitle: "Cliffside",
            lat: 36.7783,
            lng: "-119.4179",
            photoId: "photo-pin-a",
            linkLabel: "Open story",
            linkHref: "/galleries/story",
          },
        ],
        displayMode: "dotted-network",
        height: "lg",
        mapTheme: "dark",
        markerColor: "#22c55e",
        showLabels: false,
        showControls: false,
        popupMode: "hover",
        networkConnectionMode: "manual",
        networkConnections: [
          {
            id: "conn-a",
            startId: "loc-a",
            endId: "custom-pin-a",
          },
        ],
        networkLineColor: "#0ea5e9",
        networkDotColor: "#ef4444",
        networkMapDotColor: "#64748b",
        networkAnimationSeconds: 4.5,
        networkShowLabels: false,
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "map",
      type: "locationMap",
      title: "Field notes",
      locationIds: ["loc-a", "loc-b"],
      customPins: [
        {
          id: "pin-a",
          title: "Ceremony overlook",
          subtitle: "Cliffside",
          lat: "36.7783",
          lng: "-119.4179",
          photoId: "photo-pin-a",
          linkLabel: "Open story",
          linkHref: "/galleries/story",
        },
      ],
      displayMode: "dotted-network",
      height: "lg",
      mapTheme: "dark",
      markerColor: "#22c55e",
      showLabels: false,
      showControls: false,
      popupMode: "hover",
      networkConnectionMode: "manual",
      networkConnections: [
        {
          id: "conn-a",
          startId: "loc-a",
          endId: "custom-pin-a",
        },
      ],
      networkLineColor: "#0ea5e9",
      networkDotColor: "#ef4444",
      networkMapDotColor: "#64748b",
      networkAnimationSeconds: 4.5,
      networkShowLabels: false,
    });
    expect(collectPhotoIds(blocks)).toEqual(["photo-pin-a"]);
  });

  it("keeps location route planning settings", () => {
    const blocks = parseBlocks([
      {
        id: "route-map",
        type: "locationMap",
        displayMode: "route-planning",
        locationIds: ["loc-a", "loc-b", "loc-c"],
        routeStyle: "basic",
        routeProvider: "straight",
        routePointIds: ["loc-c", "loc-a", "loc-b"],
        routeStartId: "loc-a",
        routeEndId: "loc-c",
        routeShowAlternatives: false,
        routeShowCards: false,
        routeShowLabels: false,
        routeLineColor: "#111827",
        routeInactiveLineColor: "#9ca3af",
        routeStartColor: "#10b981",
        routeEndColor: "#f97316",
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "route-map",
      type: "locationMap",
      displayMode: "route-planning",
      routeStyle: "basic",
      routeProvider: "straight",
      routePointIds: ["loc-c", "loc-a", "loc-b"],
      routeStartId: "loc-a",
      routeEndId: "loc-c",
      routeShowAlternatives: false,
      routeShowCards: false,
      routeShowLabels: false,
      routeLineColor: "#111827",
      routeInactiveLineColor: "#9ca3af",
      routeStartColor: "#10b981",
      routeEndColor: "#f97316",
    });
  });

  it("keeps route planning stops between start and end", () => {
    const blocks = parseBlocks([
      {
        id: "route-map",
        type: "locationMap",
        displayMode: "route-planning",
        routeStyle: "planning",
        routeStartId: "loc-start",
        routeEndId: "loc-end",
        routePointIds: ["loc-stop-a", "loc-stop-b"],
      },
    ]);

    expect(blocks[0]).toMatchObject({
      type: "locationMap",
      displayMode: "route-planning",
      routeStyle: "planning",
      routeStartId: "loc-start",
      routeEndId: "loc-end",
      routePointIds: ["loc-stop-a", "loc-stop-b"],
    });
  });

  it("keeps Prisma hero banner settings and collects its photo", () => {
    const blocks = parseBlocks([
      {
        id: "hero",
        type: "banner",
        layout: "prisma-hero",
        source: "photo",
        photoId: "photo-hero",
        overlay: "none",
        headline: "Prisma",
        subhead: "A cinematic introduction.",
        ctaLabel: "Join us",
        ctaHref: "/contact",
        prismaVideoUrl: "https://example.com/prisma.mp4",
        prismaShowAsterisk: false,
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "hero",
      type: "banner",
      layout: "prisma-hero",
      photoId: "photo-hero",
      overlay: "none",
      prismaVideoUrl: "https://example.com/prisma.mp4",
      prismaShowAsterisk: false,
    });
    expect(collectPhotoIds(blocks)).toEqual(["photo-hero"]);
  });

  it("keeps Agency Viral hero banner settings and collects its photo", () => {
    const blocks = parseBlocks([
      {
        id: "agency-hero",
        type: "banner",
        layout: "agency-viral-hero",
        source: "photo",
        photoId: "photo-agency",
        overlay: "none",
        headline: "Agency that makes your",
        agencyAccentText: "videos & reels viral",
        subhead: "Short-form video editing for creators.",
        ctaLabel: "See our works",
        ctaHref: "/portfolio",
        agencyVideoUrl: "https://example.com/agency.mp4",
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "agency-hero",
      type: "banner",
      layout: "agency-viral-hero",
      photoId: "photo-agency",
      overlay: "none",
      agencyAccentText: "videos & reels viral",
      agencyVideoUrl: "https://example.com/agency.mp4",
    });
    expect(collectPhotoIds(blocks)).toEqual(["photo-agency"]);
  });

  it("keeps testimonial blocks and collects portrait photos", () => {
    const blocks = parseBlocks([
      {
        id: "reviews",
        type: "testimonials",
        layout: "portrait-grid",
        title: "See what all the talk is about!",
        subtitle: "Transformative client experience.",
        gridPanel: false,
        gridColumns: "2",
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
      layout: "portrait-grid",
      label: "Reviews",
      title: "See what all the talk is about!",
      subtitle: "Transformative client experience.",
      gridPanel: false,
      gridColumns: "2",
      autoplay: false,
      showThumbnails: true,
    });
    expect(collectPhotoIds(blocks)).toEqual(["photo-1"]);
  });

  it("keeps feature carousel blocks and collects selected photos", () => {
    const blocks = parseBlocks([
      {
        id: "feature-carousel",
        type: "featureCarousel",
        headline: "Edit Your Photos on the Go",
        highlightText: "Photos",
        highlightFrom: "#3b82f6",
        highlightTo: "#a855f7",
        subtitle: "Swipe through selected work.",
        photoIds: ["photo-a", "photo-b", "photo-c"],
        autoplay: true,
        autoplayMs: 3200,
        showArrows: true,
        desktopVisibleCount: "7",
        imageRadius: "full",
        primaryLabel: "Book now",
        primaryHref: "/contact",
        secondaryLabel: "View galleries",
        secondaryHref: "/galleries",
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "feature-carousel",
      type: "featureCarousel",
      headline: "Edit Your Photos on the Go",
      highlightText: "Photos",
      autoplay: true,
      autoplayMs: 3200,
      showArrows: true,
      desktopVisibleCount: "7",
      imageRadius: "full",
      primaryHref: "/contact",
      secondaryHref: "/galleries",
    });
    expect(collectPhotoIds(blocks)).toEqual(["photo-a", "photo-b", "photo-c"]);
  });

  it("keeps image comparison blocks and collects both photos", () => {
    const blocks = parseBlocks([
      {
        id: "comparison",
        type: "imageComparison",
        title: "Retouch pass",
        subtitle: "Drag to compare the edit.",
        leftPhotoId: "before-photo",
        rightPhotoId: "after-photo",
        leftLabel: "Top",
        rightLabel: "Bottom",
        comparisonOrientation: "vertical",
        initialPosition: 42,
        aspectRatio: "3-4",
        width: "full",
        rounded: false,
        showcaseBackground: false,
        backgroundColor: "#111111",
        handleColor: "#fefefe",
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "comparison",
      type: "imageComparison",
      title: "Retouch pass",
      leftPhotoId: "before-photo",
      rightPhotoId: "after-photo",
      comparisonOrientation: "vertical",
      initialPosition: 42,
      aspectRatio: "3-4",
      showcaseBackground: false,
    });
    expect(collectPhotoIds(blocks)).toEqual(["before-photo", "after-photo"]);
  });

  it("keeps book slider blocks and collects cover and page photos", () => {
    const blocks = parseBlocks([
      {
        id: "book",
        type: "bookSlider",
        title: "Wedding Guide",
        subtitle: "Click to turn the pages.",
        coverTitle: "The Guide",
        coverSubtitle: "A client welcome book",
        coverPhotoId: "cover-photo",
        size: "large",
        pageStyle: "hard",
        paperTexture: true,
        showcaseBackground: false,
        showControls: false,
        showPageNumbers: false,
        shadowStrength: 0.7,
        backgroundColor: "#f7f1e8",
        textColor: "#2d251d",
        accentColor: "#8b5e34",
        pages: [
          {
            id: "page-1",
            photoId: "page-photo-1",
            imageMode: "full",
            headline: "Arrival",
            subhead: "A calm beginning.",
            caption: "Short page caption.",
            linkLabel: "View",
            linkHref: "/galleries",
          },
          {
            id: "page-2",
            photoId: "page-photo-2",
            headline: "Details",
            subhead: "Small moments.",
          },
        ],
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "book",
      type: "bookSlider",
      title: "Wedding Guide",
      coverPhotoId: "cover-photo",
      size: "large",
      pageStyle: "hard",
      paperTexture: true,
      showcaseBackground: false,
      showControls: false,
      showPageNumbers: false,
      shadowStrength: 0.7,
      pages: [
        {
          id: "page-1",
          photoId: "page-photo-1",
          imageMode: "full",
          headline: "Arrival",
          linkHref: "/galleries",
        },
        {
          id: "page-2",
          photoId: "page-photo-2",
          headline: "Details",
        },
      ],
    });
    expect(collectPhotoIds(blocks)).toEqual([
      "cover-photo",
      "page-photo-1",
      "page-photo-2",
    ]);
  });

  it("keeps retro testimonial carousel blocks", () => {
    const blocks = parseBlocks([
      {
        id: "retro-reviews",
        type: "testimonials",
        layout: "retro-carousel",
        autoplay: true,
        items: [
          {
            id: "review-1",
            name: "Michael Rodriguez",
            affiliation: "Founder, Techstart",
            quote: "As a startup founder, I needed a quick way to build a professional-looking product.",
            photoId: "photo-retro-1",
          },
        ],
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "retro-reviews",
      type: "testimonials",
      layout: "retro-carousel",
      autoplay: true,
      showThumbnails: true,
    });
    expect(collectPhotoIds(blocks)).toEqual(["photo-retro-1"]);
  });

  it("keeps glass testimonial stack blocks", () => {
    const blocks = parseBlocks([
      {
        id: "glass-reviews",
        type: "testimonials",
        layout: "glass-stack",
        glassShowcaseBackground: false,
        glassShowcaseBackgroundColor: "#1e293b",
        autoplay: true,
        items: [
          {
            id: "review-1",
            name: "Jenn F.",
            affiliation: "Marketing Director @ Square",
            quote: "Our team shipped a campaign-ready site in a single week.",
            photoId: "photo-glass-1",
          },
          {
            id: "review-2",
            name: "Adrian Y.",
            affiliation: "Product Marketing @ Meta",
            quote: "The cards felt polished without getting in the way of the message.",
            photoId: "photo-glass-2",
          },
        ],
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "glass-reviews",
      type: "testimonials",
      layout: "glass-stack",
      glassShowcaseBackground: false,
      glassShowcaseBackgroundColor: "#1e293b",
      autoplay: true,
      showThumbnails: true,
    });
    expect(collectPhotoIds(blocks)).toEqual(["photo-glass-1", "photo-glass-2"]);
  });

  it("keeps pricing blocks with plans and feature tooltips", () => {
    const blocks = parseBlocks([
      {
        id: "price",
        type: "pricing",
        style: "glass-gradient",
        heading: "Plans that Scale with You",
        description: "Simple pricing for every client.",
        currency: "$",
        defaultFrequency: "yearly",
        showBillingToggle: true,
        theme: "dark",
        showHighlightEffect: true,
        plans: [
          {
            id: "pro",
            name: "Pro",
            info: "For small businesses",
            monthlyPrice: 17.99,
            yearlyPrice: 190,
            priceLabel: "Contact us",
            highlighted: true,
            ctaLabel: "Get started",
            ctaHref: "/contact",
            features: [
              {
                id: "support",
                text: "Priority support",
                tooltip: "Get 24/7 chat support",
                included: false,
              },
            ],
          },
        ],
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "price",
      type: "pricing",
      style: "glass-gradient",
      heading: "Plans that Scale with You",
      defaultFrequency: "yearly",
      theme: "dark",
      plans: [
        {
          id: "pro",
          highlighted: true,
          monthlyPrice: 17.99,
          yearlyPrice: 190,
          priceLabel: "Contact us",
          features: [
            {
              id: "support",
              tooltip: "Get 24/7 chat support",
              included: false,
            },
          ],
        },
      ],
    });
    expect(collectPhotoIds(blocks)).toEqual([]);
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
      creativeEyebrow: "O U R",
      creativeLogo: "RAVI",
      creativeColumns: "3",
      creativeShowCardOutline: true,
      creativeCtaLabel: "REGISTER NOW",
      creativeShowMainSocials: true,
      creativeWebsiteLabel: "www.website.com",
      marqueeSpeed: 32,
      marqueePauseOnHover: true,
      marqueeShowDecorations: true,
      marqueeShowQuote: true,
      orbitRingCount: "auto",
      orbitAutoplay: true,
      orbitSpeed: 5000,
      orbitPauseOnHover: true,
      orbitShowDots: true,
      orbitShowIconAccents: true,
      orbitButtonLabel: "Connect",
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

  it("keeps orbit team carousel settings", () => {
    const blocks = parseBlocks([
      {
        id: "team",
        type: "team",
        layout: "orbitCarousel",
        title: "Studio Team",
        orbitSubtitle: "Choose a team member from the orbit.",
        orbitRingCount: "3",
        orbitAutoplay: false,
        orbitSpeed: 6500,
        orbitPauseOnHover: false,
        orbitShowDots: false,
        orbitShowIconAccents: false,
        orbitButtonLabel: "Profile",
        orbitButtonHref: "/team",
        members: [
          {
            id: "member-1",
            name: "Orbit Member",
            role: "Producer",
            description: "Coordinates clients and creative delivery.",
            photoId: "orbit-photo",
          },
        ],
      },
    ]);

    expect(blocks[0]).toMatchObject({
      id: "team",
      type: "team",
      layout: "orbitCarousel",
      title: "Studio Team",
      orbitSubtitle: "Choose a team member from the orbit.",
      orbitRingCount: "3",
      orbitAutoplay: false,
      orbitSpeed: 6500,
      orbitPauseOnHover: false,
      orbitShowDots: false,
      orbitShowIconAccents: false,
      orbitButtonLabel: "Profile",
      orbitButtonHref: "/team",
    });
    expect(collectPhotoIds(blocks)).toEqual(["orbit-photo"]);
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

  it("keeps marquee team card settings and collects quote photos", () => {
    const blocks = parseBlocks([
      {
        id: "team",
        type: "team",
        layout: "marqueeCards",
        title: "Creative Cnippet Members",
        marqueeSubtitle: "A reference-style team marquee.",
        marqueeSpeed: 24,
        marqueePauseOnHover: false,
        marqueeShowDecorations: false,
        marqueeShowQuote: true,
        marqueeQuote: "The team moved quickly and beautifully.",
        marqueeQuoteAuthor: "Natalia Kara",
        marqueeQuoteRole: "CTO",
        marqueeQuotePhotoId: "quote-photo",
        members: [
          {
            id: "member-1",
            name: "Patrick Stewart",
            role: "CEO - Founder",
            photoId: "member-photo",
          },
        ],
      },
    ]);

    expect(blocks[0]).toMatchObject({
      id: "team",
      type: "team",
      layout: "marqueeCards",
      title: "Creative Cnippet Members",
      marqueeSubtitle: "A reference-style team marquee.",
      marqueeSpeed: 24,
      marqueePauseOnHover: false,
      marqueeShowDecorations: false,
      marqueeShowQuote: true,
      marqueeQuote: "The team moved quickly and beautifully.",
      marqueeQuoteAuthor: "Natalia Kara",
      marqueeQuoteRole: "CTO",
      marqueeQuotePhotoId: "quote-photo",
    });
    expect(collectPhotoIds(blocks)).toEqual(["quote-photo", "member-photo"]);
  });

  it("keeps creative team section settings", () => {
    const blocks = parseBlocks([
      {
        id: "team",
        type: "team",
        layout: "creativeSection",
        title: "Creative Team",
        creativeEyebrow: "OUR",
        creativeDescription: "People who shape the client experience.",
        creativeLogo: "Studio",
        creativeColumns: "4",
        creativeShowCardOutline: false,
        creativeCtaLabel: "Book now",
        creativeCtaHref: "/contact",
        creativeShowMainSocials: false,
        creativeTwitterUrl: "https://example.com/x",
        creativeFacebookUrl: "https://example.com/facebook",
        creativeInstagramUrl: "https://example.com/instagram",
        creativeYoutubeUrl: "https://example.com/youtube",
        creativeWebsiteLabel: "studio.example",
        creativeWebsiteHref: "https://studio.example",
        members: [
          {
            id: "member-1",
            name: "Emma Stone",
            role: "Product Designer",
            photoId: "creative-member-photo",
          },
        ],
      },
    ]);

    expect(blocks[0]).toMatchObject({
      id: "team",
      type: "team",
      layout: "creativeSection",
      title: "Creative Team",
      creativeEyebrow: "OUR",
      creativeDescription: "People who shape the client experience.",
      creativeLogo: "Studio",
      creativeColumns: "4",
      creativeShowCardOutline: false,
      creativeCtaLabel: "Book now",
      creativeCtaHref: "/contact",
      creativeShowMainSocials: false,
      creativeTwitterUrl: "https://example.com/x",
      creativeFacebookUrl: "https://example.com/facebook",
      creativeInstagramUrl: "https://example.com/instagram",
      creativeYoutubeUrl: "https://example.com/youtube",
      creativeWebsiteLabel: "studio.example",
      creativeWebsiteHref: "https://studio.example",
    });
    expect(collectPhotoIds(blocks)).toEqual(["creative-member-photo"]);
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
