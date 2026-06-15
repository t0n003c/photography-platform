import { getFeaturedPhotos } from "@/src/db/queries/public";
import type { PhotoDTO } from "@/src/db/queries/photos";
import type {
  InstagramItem,
  InstagramProvider,
} from "@/src/instagram/provider";

// Fallback driver — used when IG_ACCESS_TOKEN is unset. It treats recent READY
// public photos as the "feed", so the "From the field" section keeps its
// current visual behavior without any external dependency. Each item maps to a
// small/medium WebP variant URL (app-served) and links back to the site.
function feedImageUrl(photo: PhotoDTO): string | null {
  // Prefer a small WebP, then medium, then any WebP — keeps the grid light.
  const webp = photo.variants.filter((v) => v.format === "webp");
  const pick =
    webp.find((v) => v.sizeBucket === "small") ??
    webp.find((v) => v.sizeBucket === "medium") ??
    webp[0];
  return pick ? pick.url : null;
}

export class FallbackInstagramProvider implements InstagramProvider {
  async getFeed(limit: number): Promise<InstagramItem[]> {
    const photos = await getFeaturedPhotos(limit);
    const items: InstagramItem[] = [];
    for (const p of photos) {
      const imageUrl = feedImageUrl(p);
      if (!imageUrl) continue;
      items.push({
        id: p.id,
        imageUrl,
        permalink: "/",
        caption: p.altText ?? undefined,
      });
      if (items.length >= limit) break;
    }
    return items;
  }
}
