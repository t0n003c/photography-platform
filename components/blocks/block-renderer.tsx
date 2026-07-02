import type { CSSProperties } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { GalleryBlock } from "@/components/blocks/gallery-block";
import { BannerBlock } from "@/components/blocks/banner-block";
import { TestimonialSliderBlock } from "@/components/blocks/testimonial-slider-block";
import { TeamShowcaseBlock } from "@/components/blocks/team-showcase-block";
import {
  CategoryIndexBlock,
  LocationIndexBlock,
  InstagramBlock,
} from "@/components/blocks/index-blocks";
import { ScrollShowcaseBlock } from "@/components/blocks/scroll-showcase";
import { ContactForm } from "@/components/forms/contact-form";
import { collectPhotoIds, type Block, type LeafBlock } from "@/src/lib/blocks";
import { getPhotosByIds } from "@/src/db/queries/pages";
import { cn } from "@/src/lib/utils";
import type { PhotoDTO } from "@/src/db/queries/photos";

const ALIGN: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};
const SPACER_HEIGHT: Record<string, number> = {
  xs: 48,
  sm: 88,
  md: 112,
  lg: 160,
  xl: 224,
};
const GAP: Record<string, string> = {
  tight: "gap-2",
  normal: "gap-4 md:gap-6",
  airy: "gap-8 md:gap-12",
};
const IMG_WIDTH: Record<string, string> = {
  normal: "max-w-2xl",
  wide: "max-w-4xl",
  full: "max-w-none",
};
const FONT: Record<string, string> = {
  sans: "font-sans",
  serif: "font-serif",
  playfair: "font-playfair",
  cormorant: "font-cormorant",
  montserrat: "font-montserrat",
  grotesk: "font-grotesk",
};
// Per-block vertical rhythm (default py-8). Lets a heading hug its subheading.
const SPACE_Y: Record<string, string> = {
  tight: "py-2",
  normal: "py-8",
  airy: "py-16",
};
function blockPy(block: Block): string {
  if (block.type === "heading" || block.type === "subheading") {
    return SPACE_Y[block.spacing] ?? "py-8";
  }
  return "py-8";
}
const HEADING_SIZE: Record<number, string> = {
  1: "text-4xl sm:text-5xl",
  2: "text-3xl",
  3: "text-2xl",
  4: "text-xl",
  5: "text-lg",
  6: "text-base",
};
const TEXT_SIZE: Record<string, string> = {
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
};
const COL_ALIGN: Record<string, string> = {
  top: "justify-start",
  center: "justify-center",
  bottom: "justify-end",
};
const LOGO_H: Record<string, string> = { sm: "h-8", md: "h-12", lg: "h-16" };
const LOGO_GAP_ROW: Record<string, string> = {
  tighter: "gap-x-3 gap-y-2",
  tight: "gap-x-6 gap-y-4",
  normal: "gap-x-10 gap-y-6",
  airy: "gap-x-16 gap-y-10",
};
const LOGO_GAP_MARQUEE: Record<string, string> = {
  tighter: "gap-4",
  tight: "gap-8",
  normal: "gap-12",
  airy: "gap-20",
};
const LOGO_PAD_GRID: Record<string, string> = {
  tighter: "p-2",
  tight: "p-4",
  normal: "p-6",
  airy: "p-10",
};
function logoUrl(photo: PhotoDTO): string | null {
  const v = photo.variants;
  const pick =
    v.find((x) => x.format === "webp" && x.sizeBucket === "small") ??
    v.find((x) => x.format === "webp" && x.sizeBucket === "medium") ??
    v.find((x) => x.format === "webp") ??
    v[0];
  return pick?.url ?? null;
}
const CTA_BUTTON: Record<string, string> = {
  solid: "rounded-md bg-primary px-6 py-2.5 text-primary-foreground hover:opacity-90",
  pill: "rounded-full bg-primary px-6 py-2.5 text-primary-foreground hover:opacity-90",
  outline:
    "rounded-md border border-[hsl(var(--border))] px-6 py-2.5 text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]",
  soft: "rounded-md bg-[hsl(var(--muted))] px-6 py-2.5 text-[hsl(var(--foreground))] hover:opacity-80",
  link: "text-[hsl(var(--foreground))] underline underline-offset-4 hover:opacity-70",
};
const CONTACT_ALIGN: Record<string, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
};
const DIVIDER_THICKNESS: Record<string, number> = {
  hairline: 1,
  thin: 2,
  medium: 4,
  thick: 8,
};
const DIVIDER_SPACING: Record<string, [number, number]> = {
  tight: [12, 12],
  normal: [32, 32],
  airy: [56, 56],
};
const DIVIDER_WIDTH: Record<string, string> = {
  full: "w-full",
  content: "w-full max-w-2xl",
  narrow: "w-full max-w-xs",
};
const DIVIDER_ALIGN: Record<string, string> = {
  left: "mr-auto",
  center: "mx-auto",
  right: "ml-auto",
};

type PhotoMap = Map<string, PhotoDTO>;

function clampPx(value: number | undefined, fallback: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), 0), max);
}

function bandBackground(mode: string | undefined, color: string | undefined) {
  if (mode === "muted") return "hsl(var(--muted))";
  if (mode === "custom") return color || "#f4f4f5";
  return undefined;
}

function dividerColor(mode: string | undefined, color: string | undefined) {
  if (mode === "foreground") return "hsl(var(--foreground))";
  if (mode === "muted") return "hsl(var(--muted-foreground))";
  if (mode === "custom") return color || "#d4d4d8";
  return "hsl(var(--border))";
}

function spacerHeight(
  size: string | undefined,
  customHeight: number | undefined,
) {
  if (size === "custom") return clampPx(customHeight, SPACER_HEIGHT.md, 640);
  return SPACER_HEIGHT[size ?? "md"] ?? SPACER_HEIGHT.md;
}

function dividerSpacing(
  spacing: string | undefined,
  customTop: number | undefined,
  customBottom: number | undefined,
) {
  if (spacing === "custom") {
    return [
      clampPx(customTop, DIVIDER_SPACING.normal[0], 240),
      clampPx(customBottom, DIVIDER_SPACING.normal[1], 240),
    ] as const;
  }
  return DIVIDER_SPACING[spacing ?? "normal"] ?? DIVIDER_SPACING.normal;
}

function dividerLineStyle({
  style,
  thickness,
  color,
}: {
  style: string | undefined;
  thickness: string | undefined;
  color: string;
}): CSSProperties {
  const px = DIVIDER_THICKNESS[thickness ?? "hairline"] ?? 1;
  if (style === "fade") {
    return {
      height: `${px}px`,
      backgroundImage: `linear-gradient(90deg, transparent, ${color} 50%, transparent)`,
    };
  }
  if (style === "gradient") {
    return {
      height: `${px}px`,
      backgroundImage: `linear-gradient(90deg, transparent 0%, ${color} 18%, ${color} 82%, transparent 100%)`,
    };
  }
  const borderTopStyle: CSSProperties["borderTopStyle"] =
    style === "dashed" ||
    style === "dotted" ||
    style === "double" ||
    style === "solid"
      ? style
      : "solid";
  return {
    borderTopColor: color,
    borderTopStyle,
    borderTopWidth:
      style === "double" ? `${Math.max(3, px * 3)}px` : `${px}px`,
  };
}

function Paragraphs({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/\n{2,}/).filter((p) => p.trim());
  return (
    <>
      {parts.map((p, i) => (
        <p key={i} className={className}>
          {p.split("\n").map((line, j, arr) => (
            <span key={j}>
              {line}
              {j < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

function LeafView({
  block,
  photoMap,
  preview,
}: {
  block: LeafBlock;
  photoMap: PhotoMap;
  preview?: boolean;
}) {
  switch (block.type) {
    case "heading": {
      const cls = `font-semibold tracking-tight ${FONT[block.font] ?? "font-sans"} ${ALIGN[block.align]} ${HEADING_SIZE[block.level] ?? "text-2xl"}`;
      const Tag = `h${block.level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return <Tag className={cls}>{block.text}</Tag>;
    }
    case "subheading":
      return (
        <p className={`text-lg text-[hsl(var(--muted-foreground))] ${FONT[block.font] ?? "font-sans"} ${ALIGN[block.align]}`}>
          {block.text}
        </p>
      );
    case "richtext":
      return (
        <div className={`space-y-4 text-[hsl(var(--muted-foreground))] ${FONT[block.font] ?? "font-sans"} ${TEXT_SIZE[block.size] ?? "text-base"} ${ALIGN[block.align]}`}>
          <Paragraphs text={block.text} />
        </div>
      );
    case "quote":
      return (
        <blockquote className="border-l-2 border-[hsl(var(--border))] pl-4 text-xl italic">
          {block.text}
          {block.cite && (
            <footer className="mt-2 text-sm not-italic text-[hsl(var(--muted-foreground))]">
              — {block.cite}
            </footer>
          )}
        </blockquote>
      );
    case "cta":
      return (
        <div className="rounded-2xl border p-8 text-center sm:p-12">
          {block.headline && (
            <h2 className="text-2xl font-semibold tracking-tight">{block.headline}</h2>
          )}
          {block.body && (
            <p className="mx-auto mt-3 max-w-xl text-[hsl(var(--muted-foreground))]">
              {block.body}
            </p>
          )}
          <Link
            href={block.buttonHref}
            className={`mt-6 inline-flex items-center text-sm font-medium transition ${CTA_BUTTON[block.buttonStyle ?? "pill"] ?? CTA_BUTTON.pill}`}
          >
            {block.buttonLabel}
          </Link>
        </div>
      );
    case "contactForm": {
      const intro = (
        <div className={`flex flex-col ${CONTACT_ALIGN[block.align] ?? CONTACT_ALIGN.left}`}>
          {block.eyebrow && (
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
              {block.eyebrow}
            </p>
          )}
          {block.heading && (
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {block.heading}
            </h2>
          )}
          {block.body && (
            <p className="mt-4 max-w-xl text-[hsl(var(--muted-foreground))]">
              {block.body}
            </p>
          )}
        </div>
      );
      const form = <ContactForm submitLabel={block.submitLabel || "Send message"} />;

      if (block.style === "split") {
        return (
          <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-start">
            {intro}
            <div>{form}</div>
          </div>
        );
      }
      if (block.style === "card") {
        return (
          <div className="rounded-2xl border bg-[hsl(var(--background))] p-6 shadow-sm sm:p-8">
            <div className="mb-8">{intro}</div>
            {form}
          </div>
        );
      }
      if (block.style === "minimal") {
        return (
          <div>
            {(block.heading || block.body || block.eyebrow) && (
              <div className="mb-6">{intro}</div>
            )}
            <ContactForm
              submitLabel={block.submitLabel || "Send message"}
              className="[&_button]:rounded-md"
            />
          </div>
        );
      }
      return (
        <div>
          <div className="mb-8">{intro}</div>
          {form}
        </div>
      );
    }
    case "image": {
      const photo = block.photoId ? photoMap.get(block.photoId) : undefined;
      if (!photo) {
        // On the live site an unset image renders nothing; in the editor preview
        // show a placeholder so the block is visible and obviously needs a photo.
        if (!preview) return null;
        return (
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-dashed text-sm text-[hsl(var(--muted-foreground))]">
            Image — choose a photo
          </div>
        );
      }
      return (
        <figure className={`mx-auto ${IMG_WIDTH[block.width]}`}>
          <ResponsiveImage
            photo={photo}
            sizes="(max-width: 768px) 100vw, 768px"
            className={`w-full ${block.rounded ? "rounded-lg" : ""}`}
          />
          {block.caption && (
            <figcaption className="mt-2 text-center text-sm text-[hsl(var(--muted-foreground))]">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    }
    case "spacer": {
      const desktopHeight = spacerHeight(block.size, block.customHeight);
      const mobileHeight =
        block.mobileSize && block.mobileSize !== "same"
          ? spacerHeight(block.mobileSize, block.mobileCustomHeight)
          : desktopHeight;
      const backgroundColor = bandBackground(
        block.backgroundMode,
        block.backgroundColor,
      );
      const heightStyle = {
        "--spacer-mobile-height": `${mobileHeight}px`,
        "--spacer-desktop-height": `${desktopHeight}px`,
        backgroundColor,
      } as CSSProperties;
      const heightClass =
        "h-[var(--spacer-mobile-height)] sm:h-[var(--spacer-desktop-height)]";

      if (backgroundColor && block.backgroundWidth === "content") {
        return (
          <section className="spacer-block" aria-hidden>
            <Container>
              <div
                className={cn("mx-auto max-w-2xl", heightClass)}
                style={heightStyle}
              />
            </Container>
          </section>
        );
      }

      return (
        <div
          className={cn("spacer-block", heightClass)}
          style={heightStyle}
          aria-hidden
        />
      );
    }
    case "logos": {
      const logos = (block.photoIds ?? [])
        .map((pid) => photoMap.get(pid))
        .filter((p): p is PhotoDTO => !!p);
      if (logos.length === 0) {
        if (!preview) return null;
        return (
          <Container className="py-12">
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
              Logos — choose photos
            </div>
          </Container>
        );
      }
      const imgCls = `${LOGO_H[block.size] ?? "h-12"} w-auto object-contain ${
        block.grayscale
          ? "opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0"
          : ""
      }`;
      const logo = (p: PhotoDTO, key: string | number) => {
        const url = logoUrl(p);
        return url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={key} src={url} alt={p.altText ?? ""} loading="lazy" className={imgCls} />
        ) : null;
      };
      const heading = block.title ? (
        <p className="mb-8 text-center text-xs font-medium uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
          {block.title}
        </p>
      ) : null;
      return (
        <Container className="py-12">
          <div className="mx-auto max-w-5xl">
            {heading}
            {block.style === "grid" ? (
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--border))] sm:grid-cols-3 md:grid-cols-4">
                {logos.map((p, i) => (
                  <div key={i} className={`flex items-center justify-center bg-[hsl(var(--background))] ${LOGO_PAD_GRID[block.spacing] ?? "p-6"}`}>
                    {logo(p, i)}
                  </div>
                ))}
              </div>
            ) : block.style === "marquee" ? (
              <div className="overflow-hidden">
                <div className={`logo-marquee flex w-max items-center ${LOGO_GAP_MARQUEE[block.spacing] ?? "gap-12"}`}>
                  {logos.map((p, i) => logo(p, `a${i}`))}
                  {logos.map((p, i) => logo(p, `b${i}`))}
                </div>
              </div>
            ) : (
              <div className={`flex flex-wrap items-center justify-center ${LOGO_GAP_ROW[block.spacing] ?? "gap-x-10 gap-y-6"}`}>
                {logos.map((p, i) => logo(p, i))}
              </div>
            )}
          </div>
        </Container>
      );
    }
    case "divider": {
      const [paddingTop, paddingBottom] = dividerSpacing(
        block.spacing,
        block.customSpacingTop,
        block.customSpacingBottom,
      );
      const color = dividerColor(block.colorMode, block.color);
      const backgroundColor = bandBackground(
        block.backgroundMode,
        block.backgroundColor,
      );
      const label = block.label.trim();
      const lineStyle = dividerLineStyle({
        style: block.style,
        thickness: block.thickness,
        color,
      });
      const sectionStyle: CSSProperties = {
        paddingTop,
        paddingBottom,
        backgroundColor,
      };
      const widthClass = DIVIDER_WIDTH[block.width ?? "content"] ?? DIVIDER_WIDTH.content;
      const alignClass =
        block.width === "full"
          ? ""
          : DIVIDER_ALIGN[block.align ?? "center"] ?? DIVIDER_ALIGN.center;
      const divider = (
        <div className={cn(widthClass, alignClass)}>
          {label ? (
            <div
              className="flex items-center gap-3"
              role="separator"
              aria-label={label}
            >
              <span className="min-h-px flex-1 border-0" style={lineStyle} />
              <span
                className="shrink-0 text-xs font-medium uppercase tracking-[0.22em]"
                style={{ color }}
              >
                {label}
              </span>
              <span className="min-h-px flex-1 border-0" style={lineStyle} />
            </div>
          ) : (
            <div
              className="min-h-px w-full border-0"
              style={lineStyle}
              role="separator"
            />
          )}
        </div>
      );

      if (block.width === "full") {
        return (
          <section className="divider-block" style={sectionStyle}>
            {divider}
          </section>
        );
      }

      return (
        <section className="divider-block" style={sectionStyle}>
          <Container>{divider}</Container>
        </section>
      );
    }
    case "banner":
      return <BannerBlock block={block} photo={block.photoId ? photoMap.get(block.photoId) : undefined} />;
    case "gallery":
      return <GalleryBlock block={block} photoMap={photoMap} preview={preview} />;
    case "testimonials":
      return <TestimonialSliderBlock block={block} photoMap={photoMap} />;
    case "team":
      return <TeamShowcaseBlock block={block} photoMap={photoMap} />;
    case "categoryIndex":
      return <CategoryIndexBlock block={block} />;
    case "locationIndex":
      return <LocationIndexBlock block={block} />;
    case "scrollShowcase":
      return <ScrollShowcaseBlock block={block} />;
    case "instagram":
      return <InstagramBlock block={block} />;
    case "faq": {
      const items = block.items ?? [];
      const heading = block.title ? (
        <h2 className="mb-5 text-2xl font-semibold tracking-tight">{block.title}</h2>
      ) : null;
      const answer = (a: string) => (
        <p className="mt-1 whitespace-pre-line text-[hsl(var(--muted-foreground))]">{a}</p>
      );
      if (block.style === "accordion") {
        return (
          <div className={ALIGN[block.align]}>
            {heading}
            <div className="space-y-2 text-left">
              {items.map((it, i) => (
                <details key={i} className="group rounded-lg border px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                    <span>{it.q}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform group-open:rotate-180" />
                  </summary>
                  {answer(it.a)}
                </details>
              ))}
            </div>
          </div>
        );
      }
      if (block.style === "cards") {
        return (
          <div className={ALIGN[block.align]}>
            {heading}
            <div className="space-y-3 text-left">
              {items.map((it, i) => (
                <div key={i} className="rounded-lg border p-4">
                  <h3 className="font-medium">{it.q}</h3>
                  {answer(it.a)}
                </div>
              ))}
            </div>
          </div>
        );
      }
      if (block.style === "bordered") {
        return (
          <div className={ALIGN[block.align]}>
            {heading}
            <div className="divide-y border-y border-[hsl(var(--border))] text-left">
              {items.map((it, i) => (
                <div key={i} className="py-4">
                  <h3 className="font-medium">{it.q}</h3>
                  {answer(it.a)}
                </div>
              ))}
            </div>
          </div>
        );
      }
      return (
        <div className={ALIGN[block.align]}>
          {heading}
          <div className="space-y-6 text-left">
            {items.map((it, i) => (
              <div key={i}>
                <h3 className="font-medium">{it.q}</h3>
                {answer(it.a)}
              </div>
            ))}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

// Full-bleed blocks render edge-to-edge (they manage their own Container); the
// rest are wrapped in a centered container with vertical rhythm.
const FULL_BLEED = new Set([
  "banner",
  "gallery",
  "testimonials",
  "team",
  "spacer",
  "divider",
  "categoryIndex",
  "locationIndex",
  "scrollShowcase",
  "instagram",
  "logos",
]);
function isFullBleed(block: Block): boolean {
  return FULL_BLEED.has(block.type);
}

function BlockView({ block, photoMap, preview }: { block: Block; photoMap: PhotoMap; preview?: boolean }) {
  if (block.hidden) return null;

  if (block.type === "columns") {
    const cols = block.columns.length;
    const flex = block.justify === "center" || block.justify === "spread";
    const colClass =
      cols === 1 ? "" : cols === 2 ? "md:grid-cols-2" : cols === 3 ? "md:grid-cols-3" : "md:grid-cols-4";
    // "fill" stretches equal columns across the full width; "center"/"spread" let
    // each column hug its content and either cluster centered or spread to the
    // edges (balanced for short content instead of a wide empty last column).
    const justifyClass = block.justify === "spread" ? "md:justify-between" : "md:justify-center";
    const wrapClass = flex
      ? `mx-auto flex max-w-6xl flex-col items-center ${GAP[block.gap]} md:flex-row md:flex-wrap md:items-start ${justifyClass}`
      : `mx-auto max-w-6xl grid grid-cols-1 ${colClass} ${GAP[block.gap]}`;
    const colSize = flex ? "w-full md:w-auto md:flex-initial md:max-w-sm" : "";
    return (
      <Container className="py-8">
        <div className={wrapClass}>
          {block.columns.map((col, i) => (
            <div
              key={i}
              className={`flex flex-col gap-6 ${colSize} ${COL_ALIGN[block.colAlign?.[i] ?? "top"] ?? "justify-start"}`}
            >
              {col.map((leaf) => (
                leaf.hidden ? null : (
                  <LeafView key={leaf.id} block={leaf} photoMap={photoMap} preview={preview} />
                )
              ))}
            </div>
          ))}
        </div>
      </Container>
    );
  }

  if (isFullBleed(block)) {
    return <LeafView block={block} photoMap={photoMap} preview={preview} />;
  }
  if (block.type === "contactForm") {
    return (
      <Container className="py-12 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <LeafView block={block} photoMap={photoMap} preview={preview} />
        </div>
      </Container>
    );
  }
  return (
    <Container className={blockPy(block)}>
      <div className="mx-auto max-w-2xl">
        <LeafView block={block} photoMap={photoMap} preview={preview} />
      </div>
    </Container>
  );
}

// Server component: pre-fetches referenced photos once, then renders the tree.
export async function BlockRenderer({
  blocks,
  preview = false,
}: {
  blocks: Block[];
  preview?: boolean;
}) {
  const photoMap = await getPhotosByIds(collectPhotoIds(blocks));
  return (
    <>
      {blocks.map((block) => (
        // data-block-id lets the editor's "locate" button scroll to + highlight
        // this block in the live-preview iframe.
        <div key={block.id} data-block-id={block.id}>
          <BlockView block={block} photoMap={photoMap} preview={preview} />
        </div>
      ))}
    </>
  );
}
