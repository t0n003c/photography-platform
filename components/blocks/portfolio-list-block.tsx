import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { PortfolioDistortionImage } from "@/components/blocks/portfolio-distortion-image";
import {
  ToraProgressSlider,
  type ToraProgressSliderItem,
} from "@/components/blocks/tora-progress-slider";
import {
  ToraParallaxShowcase,
  type ToraParallaxShowcaseItem,
} from "@/components/blocks/tora-parallax-showcase";
import { ToraModelsMasonryMotion } from "@/components/blocks/tora-models-masonry-motion";
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
  style,
  children,
}: {
  href?: string | null;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const cleanHref = (href ?? "").trim();
  if (!cleanHref || cleanHref === "#") {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  if (isExternalHref(cleanHref)) {
    return (
      <a
        href={cleanHref}
        className={className}
        style={style}
        target="_blank"
        rel="noreferrer noopener"
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={cleanHref} className={className} style={style}>
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
            className={cn(
              "portfolio-modern-item",
              index % 2 === 0 ? "is-horizontal" : "is-vertical",
            )}
          >
            <PortfolioImage
              photo={photo}
              sizes="(min-width: 1300px) 18vw, (min-width: 768px) 30vw, 100vw"
            />
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
  const columns: PortfolioListItemData[][] = [[], [], []];
  const columnPattern = [0, 1, 2, 2, 0, 1, 2, 0];
  items.forEach((item, index) => {
    columns[columnPattern[index % columnPattern.length] ?? 0]?.push(item);
  });

  return (
    <div className="portfolio-animated-masonry">
      {columns.map((column, columnIndex) => (
        <div className="portfolio-masonry-column" key={columnIndex}>
          {column.map((item) => {
            const index = items.findIndex((candidate) => candidate.id === item.id);
            const photo = item.photoId ? photos.get(item.photoId) : undefined;
            return (
              <PortfolioLink
                key={item.id}
                href={item.linkHref}
                className={cn(
                  "portfolio-masonry-item",
                  index % 8 === 1 ? "is-vertical" : "is-horizontal",
                )}
              >
                <div className="portfolio-masonry-wrapper">
                  {item.category && <p>{item.category}</p>}
                  <div className="portfolio-masonry-content">
                    <PortfolioImage photo={photo} sizes="(min-width: 900px) 30vw, 100vw" />
                    <h3>{item.title}</h3>
                  </div>
                </div>
              </PortfolioLink>
            );
          })}
        </div>
      ))}
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
            className={cn("portfolio-mix-item", `mix-${index % 3}`)}
          >
            <PortfolioImage photo={photo} sizes="(min-width: 900px) 32vw, 100vw" />
            <div className="portfolio-mix-title">{item.title}</div>
          </PortfolioLink>
        );
      })}
    </div>
  );
}

function ToraModelsMasonry({
  items,
  photos,
}: {
  items: PortfolioListItemData[];
  photos: Map<string, PhotoDTO>;
}) {
  const visibleItems = items.filter((item) => item.title.trim() || item.photoId);
  const rows: PortfolioListItemData[][] = [];
  const rowPattern = [3, 4, 3];
  for (let index = 0; index < visibleItems.length;) {
    const rowSize = rowPattern[rows.length % rowPattern.length] ?? 3;
    rows.push(visibleItems.slice(index, index + rowSize));
    index += rowSize;
  }

  const renderModelItem = (
    item: PortfolioListItemData,
    globalIndex: number,
    rowLength: number,
    rowItemIndex: number,
  ) => {
    const photo = item.photoId ? photos.get(item.photoId) : undefined;
    return (
      <PortfolioLink
        key={item.id}
        href={item.linkHref}
        className={cn(
          "portfolio-models-item",
          `model-${globalIndex % 10}`,
          `row-item-${rowItemIndex}`,
        )}
        style={{ order: globalIndex }}
      >
        <PortfolioImage
          photo={photo}
          sizes={
            rowLength === 4
              ? "(min-width: 1200px) 48vw, (min-width: 700px) 46vw, 100vw"
              : "(min-width: 1200px) 48vw, (min-width: 700px) 42vw, 100vw"
          }
        />
        <div className="portfolio-models-title">{item.title}</div>
      </PortfolioLink>
    );
  };

  return (
    <ToraModelsMasonryMotion>
      {rows.map((row, rowIndex) => {
        const rowStartIndex = rows
          .slice(0, rowIndex)
          .reduce((count, currentRow) => count + currentRow.length, 0);
        const columnGroups =
          row.length === 4
            ? [
                [
                  { item: row[0], rowItemIndex: 0 },
                  { item: row[2], rowItemIndex: 2 },
                ],
                [
                  { item: row[1], rowItemIndex: 1 },
                  { item: row[3], rowItemIndex: 3 },
                ],
              ]
            : [];

        return (
          <div
            className={cn(
              "portfolio-models-row",
              row.length === 4 ? "is-not-same" : "is-same",
              `count-${row.length}`,
              `row-${rowIndex % rowPattern.length}`,
            )}
            key={`${rowIndex}-${row.map((item) => item.id).join("-")}`}
          >
            {row.length === 4
              ? columnGroups.map((column, columnIndex) => (
                  <div className="portfolio-models-column" key={columnIndex}>
                    {column.map(({ item, rowItemIndex }) =>
                      item
                        ? renderModelItem(
                            item,
                            rowStartIndex + rowItemIndex,
                            row.length,
                            rowItemIndex,
                          )
                        : null,
                    )}
                  </div>
                ))
              : row.map((item, itemIndex) =>
                  renderModelItem(item, rowStartIndex + itemIndex, row.length, itemIndex),
                )}
          </div>
        );
      })}
    </ToraModelsMasonryMotion>
  );
}

function ProgressSlider({
  items,
  photos,
}: {
  items: PortfolioListItemData[];
  photos: Map<string, PhotoDTO>;
}) {
  const slides: ToraProgressSliderItem[] = items.map((item, index) => ({
    id: item.id,
    title: item.title.trim() || `Gallery ${index + 1}`,
    category: item.category.trim(),
    linkHref: item.linkHref,
    photo: item.photoId ? photos.get(item.photoId) : undefined,
  }));

  return <ToraProgressSlider items={slides} />;
}

function ParallaxShowcase({
  items,
  photos,
}: {
  items: PortfolioListItemData[];
  photos: Map<string, PhotoDTO>;
}) {
  const showcaseItems: ToraParallaxShowcaseItem[] = items.map((item, index) => ({
    id: item.id,
    title: item.title.trim() || `Project ${index + 1}`,
    description: item.description,
    linkLabel: item.linkLabel,
    linkHref: item.linkHref,
    photo: item.photoId ? photos.get(item.photoId) : undefined,
  }));

  return <ToraParallaxShowcase items={showcaseItems} />;
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
  const isParallaxShowcase = style === "tora-parallax-showcase";
  const vars: CSSVars = {
    "--portfolio-bg": block.showBackground === false ? "transparent" : block.backgroundColor,
    "--portfolio-text":
      block.showBackground === false && !isParallaxShowcase
        ? "hsl(var(--foreground))"
        : block.textColor,
    "--portfolio-accent":
      block.showBackground === false && !isParallaxShowcase
        ? "hsl(var(--primary))"
        : block.accentColor,
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
        {!isParallaxShowcase && <Header block={block} />}
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
        ) : style === "tora-progress-slider" ? (
          <ProgressSlider items={items} photos={photoMap} />
        ) : style === "tora-parallax-showcase" ? (
          <ParallaxShowcase items={items} photos={photoMap} />
        ) : style === "tora-models-masonry" ? (
          <ToraModelsMasonry items={items} photos={photoMap} />
        ) : (
          <ModernList items={items} photos={photoMap} />
        )}
      </div>
    </section>
  );
}
