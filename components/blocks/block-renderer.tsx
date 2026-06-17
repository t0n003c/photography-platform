import Link from "next/link";
import { Container } from "@/components/ui/container";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { GalleryBlock } from "@/components/blocks/gallery-block";
import { BannerBlock } from "@/components/blocks/banner-block";
import {
  CategoryIndexBlock,
  LocationIndexBlock,
  InstagramBlock,
} from "@/components/blocks/index-blocks";
import { collectPhotoIds, type Block, type LeafBlock } from "@/src/lib/blocks";
import { getPhotosByIds } from "@/src/db/queries/pages";
import type { PhotoDTO } from "@/src/db/queries/photos";

const ALIGN: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};
const SPACER: Record<string, string> = { sm: "h-6", md: "h-12", lg: "h-24" };
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

type PhotoMap = Map<string, PhotoDTO>;

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

function LeafView({ block, photoMap }: { block: LeafBlock; photoMap: PhotoMap }) {
  switch (block.type) {
    case "heading": {
      const cls = `font-semibold tracking-tight ${ALIGN[block.align]} ${
        block.level === 1 ? "text-4xl sm:text-5xl" : block.level === 2 ? "text-3xl" : "text-2xl"
      }`;
      if (block.level === 1) return <h1 className={cls}>{block.text}</h1>;
      if (block.level === 2) return <h2 className={cls}>{block.text}</h2>;
      return <h3 className={cls}>{block.text}</h3>;
    }
    case "subheading":
      return (
        <p className={`text-lg text-[hsl(var(--muted-foreground))] ${ALIGN[block.align]}`}>
          {block.text}
        </p>
      );
    case "richtext":
      return (
        <div className={`space-y-4 text-[hsl(var(--muted-foreground))] ${ALIGN[block.align]}`}>
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
            className="mt-6 inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
          >
            {block.buttonLabel}
          </Link>
        </div>
      );
    case "image": {
      const photo = block.photoId ? photoMap.get(block.photoId) : undefined;
      if (!photo) return null;
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
    case "spacer":
      return <div className={SPACER[block.size]} aria-hidden />;
    case "divider":
      return <hr className="border-[hsl(var(--border))]" />;
    case "banner":
      return <BannerBlock block={block} photo={block.photoId ? photoMap.get(block.photoId) : undefined} />;
    case "gallery":
      return <GalleryBlock block={block} />;
    case "categoryIndex":
      return <CategoryIndexBlock block={block} />;
    case "locationIndex":
      return <LocationIndexBlock block={block} />;
    case "instagram":
      return <InstagramBlock block={block} />;
    default:
      return null;
  }
}

// Full-bleed blocks render edge-to-edge (they manage their own Container); the
// rest are wrapped in a centered container with vertical rhythm.
const FULL_BLEED = new Set([
  "banner",
  "gallery",
  "categoryIndex",
  "locationIndex",
  "instagram",
]);
function isFullBleed(block: Block): boolean {
  return FULL_BLEED.has(block.type);
}

function BlockView({ block, photoMap }: { block: Block; photoMap: PhotoMap }) {
  if (block.type === "columns") {
    const cols = block.columns.length;
    const colClass =
      cols === 1 ? "" : cols === 2 ? "md:grid-cols-2" : cols === 3 ? "md:grid-cols-3" : "md:grid-cols-4";
    return (
      <Container className="py-8">
        <div className={`grid grid-cols-1 ${colClass} ${GAP[block.gap]}`}>
          {block.columns.map((col, i) => (
            <div key={i} className="space-y-6">
              {col.map((leaf) => (
                <LeafView key={leaf.id} block={leaf} photoMap={photoMap} />
              ))}
            </div>
          ))}
        </div>
      </Container>
    );
  }

  if (isFullBleed(block)) {
    return <LeafView block={block} photoMap={photoMap} />;
  }
  return (
    <Container className="py-8">
      <div className="mx-auto max-w-2xl">
        <LeafView block={block} photoMap={photoMap} />
      </div>
    </Container>
  );
}

// Server component: pre-fetches referenced photos once, then renders the tree.
export async function BlockRenderer({ blocks }: { blocks: Block[] }) {
  const photoMap = await getPhotosByIds(collectPhotoIds(blocks));
  return (
    <>
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} photoMap={photoMap} />
      ))}
    </>
  );
}
