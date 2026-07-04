import { Container } from "@/components/ui/container";
import {
  LocationMapClient,
  type LocationMapPoint,
} from "@/components/blocks/location-map-client";
import { LocationDottedNetworkMap } from "@/components/blocks/location-dotted-network-map";
import { LocationRouteMap } from "@/components/blocks/location-route-map";
import { getPublishedLocationMapItems } from "@/src/db/queries/public";
import type { LeafBlock } from "@/src/lib/blocks";
import type { PhotoDTO } from "@/src/db/queries/photos";

type LocationMapBlockConfig = Extract<LeafBlock, { type: "locationMap" }>;

function coverUrl(photo: PhotoDTO | null): string | null {
  if (!photo) return null;
  const pick =
    photo.variants.find((variant) => variant.format === "webp" && variant.sizeBucket === "medium") ??
    photo.variants.find((variant) => variant.format === "webp" && variant.sizeBucket === "small") ??
    photo.variants.find((variant) => variant.format === "webp") ??
    photo.variants[0];
  return pick?.url ?? null;
}

export async function LocationMapBlock({
  block,
  photoMap,
}: {
  block: LocationMapBlockConfig;
  photoMap: Map<string, PhotoDTO>;
}) {
  const items = await getPublishedLocationMapItems(block.locationIds ?? []);
  const locationPoints: LocationMapPoint[] = items
    .filter(
      (item) =>
        typeof item.lat === "number" &&
        typeof item.lng === "number" &&
        Number.isFinite(item.lat) &&
        Number.isFinite(item.lng),
    )
    .map((item) => ({
      id: item.id,
      name: item.name,
      region: item.region,
      lat: item.lat as number,
      lng: item.lng as number,
      photoCount: item.photoCount,
      coverUrl: coverUrl(item.cover),
      href: `/locations/${item.slug}`,
      linkLabel: "Open location",
    }));
  const customPoints: LocationMapPoint[] = (block.customPins ?? [])
    .map((pin, index): LocationMapPoint | null => {
      const lat = coordinate(pin.lat);
      const lng = coordinate(pin.lng);
      if (lat == null || lng == null) return null;
      const title = pin.title.trim() || `Custom pin ${index + 1}`;
      const linkHref = pin.linkHref.trim();
      return {
        id: `custom-${pin.id}`,
        name: title,
        region: pin.subtitle.trim() || null,
        lat,
        lng,
        photoCount: null,
        coverUrl: coverUrl(pin.photoId ? photoMap.get(pin.photoId) ?? null : null),
        href: linkHref || null,
        linkLabel: pin.linkLabel.trim() || "Open",
      };
    })
    .filter((point): point is LocationMapPoint => point !== null);
  const points = [...locationPoints, ...customPoints];
  const isDottedNetwork = block.displayMode === "dotted-network";
  const isRoutePlanning = block.displayMode === "route-planning";

  return (
    <section className="py-16">
      <Container>
        {(block.title || block.subtitle) && (
          <div className={isDottedNetwork || isRoutePlanning ? "mx-auto mb-8 max-w-3xl text-center" : "mb-8 max-w-2xl"}>
            {block.title && (
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {block.title}
              </h2>
            )}
            {block.subtitle && (
              <p className="mt-3 text-[hsl(var(--muted-foreground))]">
                {block.subtitle}
              </p>
            )}
          </div>
        )}
        {isDottedNetwork ? (
          <LocationDottedNetworkMap block={block} points={points} />
        ) : isRoutePlanning ? (
          <LocationRouteMap block={block} points={points} />
        ) : (
          <LocationMapClient block={block} points={points} />
        )}
      </Container>
    </section>
  );
}

function coordinate(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}
