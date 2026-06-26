import * as React from "react";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { cn } from "@/src/lib/utils";

type Variant = PhotoDTO["variants"][number];

interface ResponsiveImageProps {
  photo: PhotoDTO;
  /** The `sizes` attribute, e.g. "100vw" or "(min-width:768px) 33vw, 50vw". */
  sizes: string;
  priority?: boolean;
  className?: string;
  /** CSS object-position for the <img> (focal point), e.g. "50% 25%". */
  objectPosition?: string;
  /** Extra inline style merged onto the <img> (e.g. a zoom transform). */
  style?: React.CSSProperties;
}

/** Filter to one format, sorted ascending by width. */
function variantsForFormat(variants: Variant[], format: string): Variant[] {
  return variants
    .filter((v) => v.format === format)
    .sort((a, b) => a.width - b.width);
}

/** Build a `srcset` string ("url 400w, url 800w, ..."). */
function buildSrcSet(variants: Variant[]): string {
  return variants.map((v) => `${v.url} ${v.width}w`).join(", ");
}

/**
 * Native <picture> with WebP primary source and JPEG fallback. Server component (no client JS).
 * Reserves intrinsic width/height to avoid layout shift, and paints a
 * dominant-color / LQIP placeholder behind the image while it loads.
 */
export function ResponsiveImage({
  photo,
  sizes,
  priority = false,
  className,
  objectPosition,
  style,
}: ResponsiveImageProps) {
  const webp = variantsForFormat(photo.variants, "webp");
  const jpeg = variantsForFormat(photo.variants, "jpeg");

  // Fallback chain for the <img> src: largest jpeg, else largest webp.
  const fallbackPool = jpeg.length > 0 ? jpeg : webp;
  const fallback = fallbackPool[fallbackPool.length - 1];

  // No usable variants at all — paint a colored box so layout still holds.
  if (!fallback) {
    return (
      <div
        className={cn("block h-full w-full", className)}
        style={{ backgroundColor: photo.dominantColor ?? "hsl(var(--muted))" }}
        aria-hidden="true"
      />
    );
  }

  const fallbackSrcSet = buildSrcSet(fallbackPool);

  const placeholderStyle: React.CSSProperties = {
    backgroundColor: photo.dominantColor ?? undefined,
  };
  if (photo.lqip) {
    placeholderStyle.backgroundImage = `url(${photo.lqip})`;
    placeholderStyle.backgroundSize = "cover";
    placeholderStyle.backgroundPosition = "center";
  }

  return (
    <picture className={cn("block", className)} style={placeholderStyle}>
      {webp.length > 0 && (
        <source type="image/webp" srcSet={buildSrcSet(webp)} sizes={sizes} />
      )}
      <img
        src={fallback.url}
        srcSet={fallbackSrcSet}
        sizes={sizes}
        width={photo.width}
        height={photo.height}
        alt={photo.altText ?? ""}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        className="block h-full w-full object-cover"
        style={
          objectPosition || style ? { objectPosition, ...style } : undefined
        }
      />
    </picture>
  );
}
