import { Container } from "@/components/ui/container";
import { Gallery } from "@/components/gallery/gallery";
import {
  FlipRevealGallery,
  type FlipRevealSortConfig,
  type FlipRevealFilterTab,
} from "@/components/gallery/flip-reveal-gallery";
import { CinematicGallery } from "@/components/webgl/cinematic-gallery";
import {
  getFeaturedPhotos,
  getCategoryPhotos,
  getLocationPhotos,
  getGalleryPhotos,
  getPhotoFilterMemberships,
  getPhotoFilterOptions,
} from "@/src/db/queries/public";
import type { PhotoDTO } from "@/src/db/queries/photos";
import type { LeafBlock } from "@/src/lib/blocks";

type GalleryBlockData = Extract<LeafBlock, { type: "gallery" }>;
type PhotoMap = Map<string, PhotoDTO>;

async function loadPhotos(block: GalleryBlockData): Promise<PhotoDTO[]> {
  const limit = block.limit;
  try {
    switch (block.source) {
      case "featured":
        return await getFeaturedPhotos(limit);
      case "category":
        return block.targetId
          ? (await getCategoryPhotos(block.targetId, null, limit)).photos
          : [];
      case "location":
        return block.targetId
          ? (await getLocationPhotos(block.targetId, null, limit)).photos
          : [];
      case "gallery":
        return block.targetId
          ? (await getGalleryPhotos(block.targetId, null, limit)).photos
          : [];
      default:
        return [];
    }
  } catch {
    return [];
  }
}

function selectedTaxonomyFilterKeys(block: GalleryBlockData): string[] {
  if (block.filterMode !== "category" && block.filterMode !== "location") {
    return [];
  }
  return [...new Set((block.filterSorts ?? []).map((filter) => filter.key).filter(Boolean))];
}

async function loadSelectedTaxonomyFilterPhotos(
  block: GalleryBlockData,
): Promise<PhotoDTO[] | null> {
  if (block.filterMode !== "category" && block.filterMode !== "location") {
    return null;
  }
  const selectedKeys = selectedTaxonomyFilterKeys(block);
  if (selectedKeys.length === 0) return null;

  const selectedTabs = await getPhotoFilterOptions(selectedKeys, block.filterMode);
  if (selectedTabs.length === 0) return null;

  const pages = await Promise.all(
    selectedTabs.map((tab) =>
      block.filterMode === "category"
        ? getCategoryPhotos(tab.key, null, block.limit)
        : getLocationPhotos(tab.key, null, block.limit),
    ),
  );
  const photosById = new Map<string, PhotoDTO>();
  for (const page of pages) {
    for (const photo of page.photos) {
      if (!photosById.has(photo.id)) photosById.set(photo.id, photo);
    }
  }
  return Array.from(photosById.values());
}

function customFilterPhotos(block: GalleryBlockData, photoMap: PhotoMap): PhotoDTO[] {
  const seen = new Set<string>();
  const photos: PhotoDTO[] = [];
  for (const filter of block.customFilters ?? []) {
    for (const photoId of filter.photoIds ?? []) {
      if (seen.has(photoId)) continue;
      const photo = photoMap.get(photoId);
      if (!photo) continue;
      seen.add(photoId);
      photos.push(photo);
    }
  }
  return photos;
}

function customFilterConfig(block: GalleryBlockData): {
  tabs: FlipRevealFilterTab[];
  photoFilters: Record<string, string[]>;
} {
  const tabs: FlipRevealFilterTab[] = [];
  const photoFilters: Record<string, string[]> = {};
  for (const filter of block.customFilters ?? []) {
    const key = filter.id;
    if (!key) continue;
    tabs.push({
      key,
      label: filter.label?.trim() || "Filter",
      photoIds: filter.photoIds ?? [],
    });
    for (const photoId of filter.photoIds ?? []) {
      photoFilters[photoId] = [...(photoFilters[photoId] ?? []), key];
    }
  }
  return { tabs, photoFilters };
}

function flipRevealSortConfig(block: GalleryBlockData): FlipRevealSortConfig {
  const customOrders = new Map(
    (block.customFilters ?? []).map((filter) => [
      filter.id,
      filter.photoIds ?? [],
    ]),
  );
  const overrides: FlipRevealSortConfig["overrides"] = {};
  for (const sort of block.filterSorts ?? []) {
    overrides[sort.key] = {
      mode: sort.sortMode ?? "source",
      photoIds:
        sort.photoIds?.length ? sort.photoIds : customOrders.get(sort.key) ?? [],
    };
  }
  return {
    mode: block.sortMode ?? "source",
    photoIds: block.manualOrderPhotoIds ?? [],
    overrides,
  };
}

async function taxonomyFilterConfig(
  photos: PhotoDTO[],
  mode: "category" | "location",
  selectedFilterKeys: string[] = [],
): Promise<{
  tabs: FlipRevealFilterTab[];
  photoFilters: Record<string, string[]>;
}> {
  const selectedKeys = [...new Set(selectedFilterKeys.filter(Boolean))];
  const selectedSet = new Set(selectedKeys);
  const memberships = await getPhotoFilterMemberships(
    photos.map((photo) => photo.id),
    mode,
  );
  const tabsByKey = new Map<string, string>();
  const photoFilters: Record<string, string[]> = {};

  for (const membership of memberships) {
    if (selectedSet.size > 0 && !selectedSet.has(membership.key)) continue;
    tabsByKey.set(membership.key, membership.label);
    photoFilters[membership.photoId] = [
      ...(photoFilters[membership.photoId] ?? []),
      membership.key,
    ];
  }

  if (selectedKeys.length > 0) {
    const selectedTabs = await getPhotoFilterOptions(selectedKeys, mode);
    if (selectedTabs.length > 0) {
      return {
        tabs: selectedTabs,
        photoFilters,
      };
    }
  }

  return {
    tabs: Array.from(tabsByKey, ([key, label]) => ({ key, label })),
    photoFilters,
  };
}

// Renders a gallery from a chosen source. The `effect` (cinematic-3d-scroll)
// is wired in Phase D; for now it renders the standard responsive grid.
export async function GalleryBlock({
  block,
  photoMap = new Map(),
  preview,
}: {
  block: GalleryBlockData;
  photoMap?: PhotoMap;
  preview?: boolean;
}) {
  const photos =
    block.filterMode === "custom"
      ? customFilterPhotos(block, photoMap)
      : (await loadSelectedTaxonomyFilterPhotos(block)) ?? await loadPhotos(block);
  if (photos.length === 0) {
    // On the live site an empty gallery renders nothing; in the editor preview
    // show why so it's not just a blank spot.
    if (!preview) return null;
    const hint =
      block.filterMode === "custom"
        ? "No custom filter photos selected yet."
        : block.source === "featured"
        ? "No featured photos yet — assign photos to a published category."
        : `No photos in the selected ${block.source}${block.targetId ? "" : " (pick a target)"}.`;
    return (
      <Container className="py-8">
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Gallery · {hint}
        </div>
      </Container>
    );
  }
  const layout = {
    gridType: block.gridType,
    spacing: block.spacing,
    autoplay: block.autoplay,
    backdrop: block.backdrop,
    toraProps: {
      useBackground: block.toraPropsShowBackground,
      backgroundColor: block.toraPropsBackgroundColor,
      captionColor: block.toraPropsCaptionColor,
      showCaptions: block.toraPropsShowCaptions,
      captionSource: block.toraPropsCaptionSource,
    },
    toraJustified: {
      useBackground: block.toraJustifiedUseBackground,
      backgroundColor: block.toraJustifiedBackgroundColor,
      titleColor: block.toraJustifiedTitleColor,
      accentColor: block.toraJustifiedAccentColor,
      titleSource: block.toraJustifiedTitleSource,
      rowHeightFactor: block.toraJustifiedRowHeightFactor,
      desktopGutter: block.toraJustifiedDesktopGutter,
      mobileGutter: block.toraJustifiedMobileGutter,
      hoverInset: block.toraJustifiedHoverInset,
      dimOnLeadHover: block.toraJustifiedDimOnLeadHover,
      scrollOnSelect: block.toraJustifiedScrollOnSelect,
      showBlurredSideFill: block.toraJustifiedShowBlurredSideFill,
    },
  };

  // Cinematic 3D scroll is a layout choice (gridType) — it renders full-bleed
  // and manages its own height, degrading to a standard grid when WebGL is
  // gated off. `effect === "cinematic-3d-scroll"` is the legacy form, kept so
  // pages saved before it moved to the grid picker still render.
  if (block.gridType === "cinematic") {
    return (
      <CinematicGallery
        photos={photos}
        layout={{ gridType: "cinematic", spacing: block.spacing }}
        speed={block.effectSpeed ?? 1}
      />
    );
  }

  if (block.effect === "cinematic-3d-scroll") {
    return (
      <CinematicGallery
        photos={photos}
        layout={{ gridType: "justified", spacing: block.spacing }}
        speed={block.effectSpeed ?? 1}
      />
    );
  }

  if (block.filterMode && block.filterMode !== "none") {
    const filterStyle = block.filterStyle ?? "flip-reveal";
    const config =
      block.filterMode === "custom"
        ? customFilterConfig(block)
        : await taxonomyFilterConfig(
            photos,
            block.filterMode,
            selectedTaxonomyFilterKeys(block),
          );
    if (config.tabs.length > 0) {
      const gallery = (
        <FlipRevealGallery
          photos={photos}
          tabs={config.tabs}
          photoFilters={config.photoFilters}
          filterStyle={filterStyle}
          showOverlayText={block.showOverlayText ?? true}
          sort={flipRevealSortConfig(block)}
        />
      );
      if (filterStyle === "tora-portfolio-masonry") {
        return gallery;
      }
      return (
        <Container className="py-8">
          {gallery}
        </Container>
      );
    }
  }

  if (
    block.gridType === "tora-props-catalog" ||
    block.gridType === "tora-justified-showcase"
  ) {
    return <Gallery photos={photos} layout={layout} />;
  }

  return (
    <Container className="py-8">
      <Gallery photos={photos} layout={layout} />
    </Container>
  );
}
