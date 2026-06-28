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
import { LayoutFormationsClient } from "./layout-formations-client";
import { ScrollLayoutsClient } from "./scroll-layouts-client";
import { ScrollPanelsClient } from "./scroll-panels-client";

const RING_SIZE = 10; // photos per 3D-carousel ring
const SCROLL_LAYOUT_COUNTS: Record<string, number> = {
  row: 7,
  breakout: 9,
  grid10: 16,
  stackDark: 6,
  stackGlass: 6,
  stackScale: 6,
  bento: 8,
  single: 1,
};

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

  const scrollPanelsRowCount =
    block.style === "scrollPanels" ? (block.scrollPanelsRowCount ?? 5) : 0;
  const scrollPanelsIntroCount =
    block.style === "scrollPanels" ? (block.scrollPanelsIntroCount ?? 12) : 0;
  const layoutFormationsPhotoCount =
    block.style === "layoutFormations"
      ? block.layoutFormationsPhotoCount === 17
        ? 18
        : (block.layoutFormationsPhotoCount ?? 12)
      : 0;
  const scrollLayoutsPhotoCount =
    block.style === "scrollLayouts"
      ? block.scrollLayoutsVariant === "tiny"
        ? (block.scrollLayoutsPhotoCount ?? 80)
        : (SCROLL_LAYOUT_COUNTS[block.scrollLayoutsVariant ?? "row"] ?? 9)
      : 0;
  const photoFetchCount =
    block.style === "scrollPanels"
      ? Math.max(
          block.clusterCount + 2,
          scrollPanelsRowCount + 1,
          scrollPanelsIntroCount + 1,
        )
      : block.style === "layoutFormations"
        ? Math.max(layoutFormationsPhotoCount + 1, 7)
        : block.style === "scrollLayouts"
          ? Math.max(scrollLayoutsPhotoCount + 1, 9)
          : block.clusterCount + 2;

  const panels = (
    await Promise.all(
      categories.map(async (c): Promise<ShowcasePanel | null> => {
        // Fetch a couple extra so we can drop the cover from the cluster and
        // still have enough images flying in.
        const { photos } = await getCategoryPhotos(
          c.id,
          null,
          photoFetchCount,
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
          description: c.description,
          background,
          // Always keep at least one image flying in.
          cluster:
            block.style === "scrollPanels"
              ? pool.slice(
                  0,
                  Math.max(scrollPanelsRowCount - 1, scrollPanelsIntroCount, 1),
                )
              : block.style === "layoutFormations"
                ? pool.slice(0, layoutFormationsPhotoCount)
                : block.style === "scrollLayouts"
                  ? pool.slice(0, scrollLayoutsPhotoCount)
                  : cluster.length > 0 ? cluster : [background],
        };
      }),
    )
  ).filter((p): p is ShowcasePanel => p !== null);

  if (panels.length === 0) return null;

  if (block.style === "scrollPanels") {
    const rawVariant = block.scrollPanelsVariant ?? "classic";
    const variant =
      rawVariant === "zoom" || rawVariant === "brightness"
        ? "demo4"
        : rawVariant;
    return (
      <ScrollPanelsClient
        panels={panels}
        title={block.title}
        showTitles={block.showTitles}
        variant={variant}
        introCount={scrollPanelsIntroCount}
        rowCount={block.scrollPanelsRowCount ?? 5}
        tone={block.scrollPanelsTone ?? "color"}
        introAlign={block.scrollPanelsIntroAlign ?? "left"}
        useBackground={block.scrollPanelsUseBackground ?? true}
        background={block.scrollPanelsBackground ?? "#f4f0e8"}
        textColor={block.scrollPanelsTextColor ?? "#171717"}
        introHeading={block.scrollPanelsIntroHeading ?? "Selected Stories"}
        introText={
          block.scrollPanelsIntroText ??
          "Scroll through featured collections, places, and small visual fragments from the archive."
        }
        showcaseHeading={block.scrollPanelsShowcaseHeading ?? "Selected Work"}
      />
    );
  }

  if (block.style === "layoutFormations") {
    return (
      <LayoutFormationsClient
        panels={panels}
        title={block.title}
        showTitles={block.showTitles}
        variant={block.layoutFormationsVariant ?? "rise"}
        photoCount={layoutFormationsPhotoCount}
        headerAlign={block.layoutFormationsHeaderAlign ?? "left"}
        heading={block.layoutFormationsHeading ?? "Layout formations"}
      />
    );
  }

  if (block.style === "scrollLayouts") {
    return (
      <ScrollLayoutsClient
        panels={panels}
        title={block.title}
        showTitles={block.showTitles}
        variant={block.scrollLayoutsVariant ?? "row"}
        photoCount={scrollLayoutsPhotoCount}
        heading={block.scrollLayoutsHeading ?? "Scroll layout morphs"}
        introText={
          block.scrollLayoutsIntroText ??
          "Pinned image layouts morph between editorial compositions as you scroll."
        }
        caption={block.scrollLayoutsCaption ?? ""}
        useBackground={block.scrollLayoutsUseBackground ?? true}
        background={block.scrollLayoutsBackground ?? "#131417"}
        textColor={block.scrollLayoutsTextColor ?? "#ffffff"}
      />
    );
  }

  return (
    <ScrollShowcaseClient
      panels={panels}
      title={block.title}
      showTitles={block.showTitles}
    />
  );
}
