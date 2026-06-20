import { Container } from "@/components/ui/container";
import { Gallery } from "@/components/gallery/gallery";
import { CinematicGallery } from "@/components/webgl/cinematic-gallery";
import {
  getFeaturedPhotos,
  getCategoryPhotos,
  getLocationPhotos,
  getGalleryPhotos,
} from "@/src/db/queries/public";
import type { PhotoDTO } from "@/src/db/queries/photos";
import type { LeafBlock } from "@/src/lib/blocks";

type GalleryBlockData = Extract<LeafBlock, { type: "gallery" }>;

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

// Renders a gallery from a chosen source. The `effect` (cinematic-3d-scroll)
// is wired in Phase D; for now it renders the standard responsive grid.
export async function GalleryBlock({
  block,
  preview,
}: {
  block: GalleryBlockData;
  preview?: boolean;
}) {
  const photos = await loadPhotos(block);
  if (photos.length === 0) {
    // On the live site an empty gallery renders nothing; in the editor preview
    // show why so it's not just a blank spot.
    if (!preview) return null;
    const hint =
      block.source === "featured"
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
  const layout = { gridType: block.gridType, spacing: block.spacing, autoplay: block.autoplay };

  // Cinematic 3D scroll is a layout choice (gridType) — it renders full-bleed
  // and manages its own height, degrading to a standard grid when WebGL is
  // gated off. `effect === "cinematic-3d-scroll"` is the legacy form, kept so
  // pages saved before it moved to the grid picker still render.
  if (block.gridType === "cinematic" || block.effect === "cinematic-3d-scroll") {
    return <CinematicGallery photos={photos} layout={layout} speed={block.effectSpeed ?? 1} />;
  }
  return (
    <Container className="py-8">
      <Gallery photos={photos} layout={layout} />
    </Container>
  );
}
