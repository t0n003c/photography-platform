import {
  getPublishedCategories,
  getCategoryPhotos,
} from "@/src/db/queries/public";
import { getPhotosByIds } from "@/src/db/queries/pages";
import type { LeafBlock } from "@/src/lib/blocks";
import {
  ScrollShowcaseClient,
  type ShowcasePanel,
} from "./scroll-showcase-client";
import { Carousel3DScroll, type CarouselScene } from "./carousel-3d-scroll";

const RING_SIZE = 10; // photos per 3D-carousel ring

// Cinematic, scroll-driven showcase. Auto-sources published categories (like the
// Category index block); each becomes a full-screen panel: cover photo as the
// background, the next few photos as the flying cluster, its name as the title.
export async function ScrollShowcaseBlock({
  block,
}: {
  block: Extract<LeafBlock, { type: "scrollShowcase" }>;
}) {
  const published = await getPublishedCategories();
  // Manual selection (in the chosen order) when categoryIds is set; otherwise
  // all published categories capped by `limit`. Only published categories are
  // candidates, so an unpublished/deleted pick is simply skipped.
  const categoryIds = block.categoryIds ?? [];
  const categories =
    categoryIds.length > 0
      ? categoryIds
          .map((id) => published.find((c) => c.id === id))
          .filter((c): c is (typeof published)[number] => c != null)
      : published.slice(0, block.limit);
  if (categories.length === 0) return null;

  // 3D-carousel style: each category becomes a ring of its photos.
  if (block.style === "carousel3d") {
    const scenes = (
      await Promise.all(
        categories.map(async (c): Promise<CarouselScene | null> => {
          const { photos } = await getCategoryPhotos(c.id, null, RING_SIZE);
          if (photos.length === 0) return null;
          return { slug: c.slug, name: c.name, kind: "category", photos };
        }),
      )
    ).filter((s): s is CarouselScene => s !== null);
    if (scenes.length === 0) return null;
    return <Carousel3DScroll scenes={scenes} />;
  }

  const panels = (
    await Promise.all(
      categories.map(async (c): Promise<ShowcasePanel | null> => {
        // Fetch a couple extra so we can drop the cover from the cluster and
        // still have enough images flying in.
        const { photos } = await getCategoryPhotos(
          c.id,
          null,
          block.clusterCount + 2,
        );
        if (photos.length === 0) return null;

        // Background = the category's chosen cover photo; fall back to the first
        // photo when no cover is set (or the cover isn't usable).
        let background = photos[0];
        let usedExplicitCover = false;
        if (c.coverPhotoId) {
          const inList = photos.find((p) => p.id === c.coverPhotoId);
          if (inList) {
            background = inList;
            usedExplicitCover = true;
          } else {
            const extra = await getPhotosByIds([c.coverPhotoId]);
            const cover = extra.get(c.coverPhotoId);
            if (cover && cover.variants.length > 0) {
              background = cover;
              usedExplicitCover = true;
            }
          }
        }

        // Only drop the photo from the cluster when it's an EXPLICIT cover, so it
        // isn't shown twice. With no cover, the background is just the first photo
        // as a fallback — keep it in the cluster so the first photo isn't skipped.
        const pool = usedExplicitCover
          ? photos.filter((p) => p.id !== background.id)
          : photos;
        const cluster = pool.slice(0, block.clusterCount);
        return {
          slug: c.slug,
          name: c.name,
          background,
          // Always keep at least one image flying in.
          cluster: cluster.length > 0 ? cluster : [background],
        };
      }),
    )
  ).filter((p): p is ShowcasePanel => p !== null);

  if (panels.length === 0) return null;

  return (
    <ScrollShowcaseClient
      panels={panels}
      title={block.title}
      showTitles={block.showTitles}
    />
  );
}
