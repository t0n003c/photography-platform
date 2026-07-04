import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { PortfolioDistortionImage } from "@/components/blocks/portfolio-distortion-image";
import type { PhotoDTO } from "@/src/db/queries/photos";
import type { LeafBlock } from "@/src/lib/blocks";
import { cn } from "@/src/lib/utils";

type PortfolioListBlockData = Extract<LeafBlock, { type: "portfolioList" }>;
type PortfolioListItemData = PortfolioListBlockData["items"][number];
type CSSVars = CSSProperties & { [key: `--${string}`]: string | number | undefined };

function photoUrl(photo?: PhotoDTO) {
  if (!photo) return null;
  const webp = photo.variants
    .filter((variant) => variant.format === "webp")
    .sort((a, b) => b.width - a.width);
  const jpeg = photo.variants
    .filter((variant) => variant.format === "jpeg")
    .sort((a, b) => b.width - a.width);
  return webp[0]?.url ?? jpeg[0]?.url ?? photo.variants[0]?.url ?? null;
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function PortfolioLink({
  href,
  className,
  children,
}: {
  href?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const cleanHref = (href ?? "").trim();
  if (!cleanHref || cleanHref === "#") return <div className={className}>{children}</div>;
  if (isExternalHref(cleanHref)) {
    return (
      <a href={cleanHref} className={className} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  }
  return (
    <Link href={cleanHref} className={className}>
      {children}
    </Link>
  );
}

function PortfolioImage({
  photo,
  className,
  sizes,
  priority = false,
}: {
  photo?: PhotoDTO;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("portfolio-list-image", className)}>
      {photo ? (
        <ResponsiveImage photo={photo} sizes={sizes} priority={priority} className="h-full w-full" />
      ) : (
        <div className="portfolio-list-placeholder" aria-hidden="true" />
      )}
    </div>
  );
}

function Header({ block }: { block: PortfolioListBlockData }) {
  const eyebrow = (block.eyebrow ?? "").trim();
  const title = (block.title ?? "").trim();
  const body = (block.body ?? "").trim();
  if (!eyebrow && !title && !body) return null;
  return (
    <div className="portfolio-list-heading">
      {eyebrow && <div className="portfolio-list-eyebrow">{eyebrow}</div>}
      {title && <h2>{title}</h2>}
      {body && <p>{body}</p>}
    </div>
  );
}

function ModernList({
  items,
  photos,
}: {
  items: PortfolioListItemData[];
  photos: Map<string, PhotoDTO>;
}) {
  return (
    <div className="portfolio-modern-grid">
      {items.map((item, index) => {
        const photo = item.photoId ? photos.get(item.photoId) : undefined;
        return (
          <PortfolioLink
            key={item.id}
            href={item.linkHref}
            className={cn("portfolio-modern-item", index % 2 === 1 && "is-even")}
          >
            <PortfolioImage photo={photo} sizes="(min-width: 1100px) 18vw, (min-width: 768px) 32vw, 100vw" />
            <div className="portfolio-card-copy">
              <h3>{item.title}</h3>
              {item.category && <p>{item.category}</p>}
            </div>
          </PortfolioLink>
        );
      })}
    </div>
  );
}

function CategoryCards({
  items,
  photos,
}: {
  items: PortfolioListItemData[];
  photos: Map<string, PhotoDTO>;
}) {
  return (
    <div className="portfolio-category-grid">
      {items.slice(0, 6).map((item) => {
        const photo = item.photoId ? photos.get(item.photoId) : undefined;
        return (
          <PortfolioLink key={item.id} href={item.linkHref} className="portfolio-category-card">
            <PortfolioImage photo={photo} sizes="(min-width: 900px) 29vw, 100vw" />
            <h3>{item.title}</h3>
          </PortfolioLink>
        );
      })}
    </div>
  );
}

function DistortionFeature({
  item,
  photos,
}: {
  item: PortfolioListItemData;
  photos: Map<string, PhotoDTO>;
}) {
  const photo = item.photoId ? photos.get(item.photoId) : undefined;
  const hoverPhoto =
    item.hoverPhotoId && item.hoverPhotoId !== item.photoId
      ? photos.get(item.hoverPhotoId)
      : undefined;
  const primarySrc = photoUrl(photo);
  const secondarySrc = photoUrl(hoverPhoto);
  return (
    <div className="portfolio-distortion-feature">
      <div className="portfolio-distortion-copy">
        {item.category && <div className="portfolio-distortion-category">{item.category}</div>}
        <h3>{item.title}</h3>
        {item.description && <p>{item.description}</p>}
        {item.linkLabel && (
          <PortfolioLink href={item.linkHref} className="portfolio-read-more">
            <span>{item.linkLabel}</span>
          </PortfolioLink>
        )}
      </div>
      <div className="portfolio-distortion-media">
        <PortfolioImage photo={photo} sizes="(min-width: 900px) 50vw, 100vw" priority />
        <PortfolioDistortionImage primarySrc={primarySrc} secondarySrc={secondarySrc} />
      </div>
    </div>
  );
}

function AnimatedMasonry({
  items,
  photos,
}: {
  items: PortfolioListItemData[];
  photos: Map<string, PhotoDTO>;
}) {
  return (
    <div className="portfolio-animated-masonry">
      {items.map((item, index) => {
        const photo = item.photoId ? photos.get(item.photoId) : undefined;
        return (
          <PortfolioLink
            key={item.id}
            href={item.linkHref}
            className={cn("portfolio-masonry-item", `shape-${index % 4}`)}
          >
            <PortfolioImage photo={photo} sizes="(min-width: 900px) 30vw, 100vw" />
            <div className="portfolio-card-copy">
              {item.category && <p>{item.category}</p>}
              <h3>{item.title}</h3>
            </div>
          </PortfolioLink>
        );
      })}
    </div>
  );
}

function MixMasonry({
  items,
  photos,
}: {
  items: PortfolioListItemData[];
  photos: Map<string, PhotoDTO>;
}) {
  return (
    <div className="portfolio-mix-grid">
      {items.slice(0, 9).map((item, index) => {
        const photo = item.photoId ? photos.get(item.photoId) : undefined;
        return (
          <PortfolioLink
            key={item.id}
            href={item.linkHref}
            className={cn("portfolio-mix-item", `mix-${index % 5}`)}
          >
            <PortfolioImage photo={photo} sizes="(min-width: 900px) 32vw, 100vw" />
            <div className="portfolio-mix-title">{item.title}</div>
          </PortfolioLink>
        );
      })}
    </div>
  );
}

export function PortfolioListBlock({
  block,
  photoMap,
}: {
  block: PortfolioListBlockData;
  photoMap: Map<string, PhotoDTO>;
}) {
  const items = block.items ?? [];
  const style = block.style ?? "modern";
  const vars: CSSVars = {
    "--portfolio-bg": block.showBackground === false ? "transparent" : block.backgroundColor,
    "--portfolio-text":
      block.showBackground === false ? "hsl(var(--foreground))" : block.textColor,
    "--portfolio-accent":
      block.showBackground === false ? "hsl(var(--primary))" : block.accentColor,
  };

  return (
    <section
      className={cn(
        "portfolio-list-block",
        `portfolio-list-${style}`,
        block.showBackground === false && "portfolio-list-no-bg",
      )}
      style={vars}
    >
      <div className="portfolio-list-container">
        <Header block={block} />
        {items.length === 0 ? (
          <div className="portfolio-list-empty">Portfolio list - add items</div>
        ) : style === "category-cards" ? (
          <CategoryCards items={items} photos={photoMap} />
        ) : style === "distortion" ? (
          <DistortionFeature item={items[0]} photos={photoMap} />
        ) : style === "animated-masonry" ? (
          <AnimatedMasonry items={items} photos={photoMap} />
        ) : style === "mix-masonry" ? (
          <MixMasonry items={items} photos={photoMap} />
        ) : (
          <ModernList items={items} photos={photoMap} />
        )}
      </div>
    </section>
  );
}
