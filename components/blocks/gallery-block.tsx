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
export async function GalleryBlock({ block }: { block: GalleryBlockData }) {
  const photos = await loadPhotos(block);
  if (photos.length === 0) return null;
  const layout = { gridType: block.gridType, spacing: block.spacing };

  // Opt-in cinematic 3D scroll renders full-bleed (it manages its own height);
  // it degrades to the standard grid when WebGL is gated off.
  if (block.effect === "cinematic-3d-scroll") {
    return <CinematicGallery photos={photos} layout={layout} />;
  }
  return (
    <Container className="py-8">
      <Gallery photos={photos} layout={layout} />
    </Container>
  );
}
