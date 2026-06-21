import {
  getPublishedCategories,
  getCategoryPhotos,
} from "@/src/db/queries/public";
import type { LeafBlock } from "@/src/lib/blocks";
import {
  ScrollShowcaseClient,
  type ShowcasePanel,
} from "./scroll-showcase-client";

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
  const categories =
    block.categoryIds.length > 0
      ? block.categoryIds
          .map((id) => published.find((c) => c.id === id))
          .filter((c): c is (typeof published)[number] => c != null)
      : published.slice(0, block.limit);
  if (categories.length === 0) return null;

  const panels = (
    await Promise.all(
      categories.map(async (c): Promise<ShowcasePanel | null> => {
        const { photos } = await getCategoryPhotos(
          c.id,
          null,
          block.clusterCount + 1,
        );
        if (photos.length === 0) return null;
        const [background, ...rest] = photos;
        return {
          slug: c.slug,
          name: c.name,
          background,
          // Fall back to the cover itself if the category has only one photo, so
          // there's always at least one image flying in.
          cluster: rest.length > 0 ? rest : [background],
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
