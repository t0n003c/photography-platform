import * as React from "react";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { cn } from "@/src/lib/utils";

export type CssGlitchVariant =
  | "hero-haunted"
  | "hero-ethereal"
  | "style-1"
  | "style-2"
  | "style-3"
  | "style-4"
  | "style-5"
  | "style-6";

type CssVars = React.CSSProperties & {
  "--glitch-image"?: string;
  "--glitch-x"?: string;
  "--glitch-y"?: string;
};

function bestImageUrl(photo: PhotoDTO): string | null {
  const webp = photo.variants
    .filter((variant) => variant.format === "webp")
    .sort((a, b) => b.width - a.width)[0];
  const jpeg = photo.variants
    .filter((variant) => variant.format === "jpeg")
    .sort((a, b) => b.width - a.width)[0];
  return webp?.url ?? jpeg?.url ?? null;
}

export function CssGlitchImage({
  photo,
  variant,
  className,
  objectPosition = "50% 50%",
  mode = "card",
}: {
  photo: PhotoDTO;
  variant: CssGlitchVariant;
  className?: string;
  objectPosition?: string;
  mode?: "hero" | "card";
}) {
  const imageUrl = bestImageUrl(photo);
  const style: CssVars = imageUrl
    ? {
        "--glitch-image": `url("${imageUrl}")`,
        backgroundColor: photo.dominantColor ?? undefined,
        backgroundImage: photo.lqip ? `url("${photo.lqip}")` : undefined,
        backgroundSize: "cover",
        backgroundPosition: objectPosition,
      }
    : { backgroundColor: photo.dominantColor ?? "hsl(var(--muted))" };

  return (
    <div
      className={cn(
        "css-glitch",
        `css-glitch--${variant}`,
        mode === "hero" ? "css-glitch--hero" : "css-glitch--card",
        className,
      )}
      style={style}
      aria-hidden="true"
    >
      {[0, 1, 2, 3, 4].map((layer) => (
        <span
          key={layer}
          className="css-glitch__layer"
          style={
            {
              "--glitch-x": objectPosition.split(" ")[0] ?? "50%",
              "--glitch-y": objectPosition.split(" ")[1] ?? "50%",
            } as CssVars
          }
        />
      ))}
    </div>
  );
}
