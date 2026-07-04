"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import maplibregl, { type Map as MapLibreMap, type Marker } from "maplibre-gl";
import { ExternalLink, Images, MapPin, Navigation, X } from "lucide-react";
import type { LeafBlock } from "@/src/lib/blocks";
import { cn } from "@/src/lib/utils";

type LocationMapBlock = Extract<LeafBlock, { type: "locationMap" }>;

export interface LocationMapPoint {
  id: string;
  slug: string;
  name: string;
  region: string | null;
  lat: number;
  lng: number;
  photoCount: number;
  coverUrl: string | null;
}

const STYLE_URLS = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  bright: "https://tiles.openfreemap.org/styles/bright",
} as const;

const HEIGHT_CLASS: Record<LocationMapBlock["height"], string> = {
  sm: "h-[22rem] sm:h-[26rem]",
  md: "h-[30rem] sm:h-[34rem]",
  lg: "h-[38rem] sm:h-[44rem]",
  screen: "h-[calc(100svh-8rem)] min-h-[34rem]",
};

function resolveTheme(theme: LocationMapBlock["mapTheme"]) {
  if (theme === "light" || theme === "dark" || theme === "liberty" || theme === "bright") {
    return theme;
  }
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
    return "dark";
  }
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function styleUrl(theme: LocationMapBlock["mapTheme"]) {
  return STYLE_URLS[resolveTheme(theme)];
}

function directionsHref(point: LocationMapPoint) {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;
}

function LocationPopupCard({
  point,
  className,
}: {
  point: LocationMapPoint;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "w-[16.5rem] overflow-hidden rounded-md bg-[hsl(var(--background))] text-[hsl(var(--foreground))]",
        className,
      )}
    >
      {point.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={point.coverUrl}
          alt={point.name}
          className="h-32 w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="space-y-2 p-3">
        <div>
          <p className="pb-0.5 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            {point.region || "Portfolio location"}
          </p>
          <h3 className="font-semibold leading-tight">{point.name}</h3>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))]">
          <Images className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {point.photoCount} {point.photoCount === 1 ? "photo" : "photos"}
          </span>
        </div>
        <div className="flex gap-2 pt-1">
          <a
            href={directionsHref(point)}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
            Directions
          </a>
          <a
            href={`/locations/${point.slug}`}
            aria-label={`Open ${point.name}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-[hsl(var(--background))] text-sm shadow-sm transition hover:bg-[hsl(var(--muted))]"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
}

function fitPoints(map: MapLibreMap, points: LocationMapPoint[], reduceMotion: boolean) {
  if (points.length === 0) return;
  if (points.length === 1) {
    map.easeTo({
      center: [points[0].lng, points[0].lat],
      zoom: 9.5,
      duration: reduceMotion ? 0 : 650,
    });
    return;
  }
  const bounds = new maplibregl.LngLatBounds();
  for (const point of points) bounds.extend([point.lng, point.lat]);
  map.fitBounds(bounds, {
    padding: { top: 82, right: 72, bottom: 92, left: 72 },
    maxZoom: 10,
    duration: reduceMotion ? 0 : 750,
  });
}

export function LocationMapClient({
  block,
  points,
}: {
  block: LocationMapBlock;
  points: LocationMapPoint[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const currentStyleUrlRef = useRef<string | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const popupRootsRef = useRef<Root[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePoint, setMobilePoint] = useState<LocationMapPoint | null>(null);
  const mappedPoints = useMemo(
    () => points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)),
    [points],
  );

  useEffect(() => {
    setIsMounted(true);
    const query = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || mappedPoints.length === 0) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const first = mappedPoints[0];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl(block.mapTheme),
      center: [first.lng, first.lat],
      zoom: mappedPoints.length === 1 ? 9.5 : 3,
      attributionControl: { compact: true },
      renderWorldCopies: false,
    });
    currentStyleUrlRef.current = styleUrl(block.mapTheme);
    mapRef.current = map;
    if (block.showControls) {
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: true, showZoom: true }),
        "bottom-right",
      );
    }
    map.on("load", () => fitPoints(map, mappedPoints, reduceMotion));
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      popupRootsRef.current.forEach((root) => root.unmount());
      popupRootsRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // Initialize the map once; markers/style sync in separate effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappedPoints.length]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const applyStyle = () => {
      const nextStyle = styleUrl(block.mapTheme);
      if (currentStyleUrlRef.current === nextStyle) return;
      currentStyleUrlRef.current = nextStyle;
      map.setStyle(nextStyle, { diff: true });
    };
    applyStyle();
    const observer = new MutationObserver(applyStyle);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [block.mapTheme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mappedPoints.length === 0) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const refit = () => fitPoints(map, mappedPoints, reduceMotion);
    if (map.loaded()) {
      refit();
    } else {
      map.once("load", refit);
    }
    return () => {
      map.off("load", refit);
    };
  }, [mappedPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    popupRootsRef.current.forEach((root) => root.unmount());
    popupRootsRef.current = [];

    for (const point of mappedPoints) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "location-map-marker group";
      el.dataset.locationMarker = point.id;
      el.setAttribute("aria-label", point.name);
      const dot = document.createElement("span");
      dot.className = "location-map-marker-dot";
      dot.style.background = block.markerColor;
      el.append(dot);
      if (block.showLabels) {
        const label = document.createElement("span");
        label.className = "location-map-marker-label";
        label.textContent = point.region || point.name;
        el.append(label);
      }

      const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([
        point.lng,
        point.lat,
      ]);

      if (isMobile) {
        el.addEventListener("click", (event) => {
          event.preventDefault();
          setMobilePoint(point);
          map.easeTo({ center: [point.lng, point.lat], duration: 350 });
        });
      } else {
        const popupContainer = document.createElement("div");
        const popupRoot = createRoot(popupContainer);
        popupRoot.render(<LocationPopupCard point={point} />);
        popupRootsRef.current.push(popupRoot);
        const popup = new maplibregl.Popup({
          offset: 18,
          closeButton: false,
          maxWidth: "none",
        }).setDOMContent(popupContainer);
        marker.setPopup(popup);
        if (block.popupMode === "hover") {
          el.addEventListener("mouseenter", () =>
            popup.setLngLat([point.lng, point.lat]).addTo(map),
          );
          el.addEventListener("mouseleave", () => popup.remove());
        }
      }

      marker.addTo(map);
      markersRef.current.push(marker);
    }
  }, [block.markerColor, block.popupMode, block.showLabels, isMobile, mappedPoints]);

  if (mappedPoints.length === 0) {
    return (
      <div className="rounded-xl border bg-[hsl(var(--muted))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
        Add latitude and longitude to published locations to show them on this map.
      </div>
    );
  }

  return (
    <div className="location-map-block grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div
        className={cn(
          "relative min-w-0 overflow-hidden rounded-xl border bg-[hsl(var(--muted))] shadow-sm",
          HEIGHT_CLASS[block.height],
        )}
      >
        <div ref={containerRef} className="absolute inset-0" aria-hidden={!isMounted} />
        {!isMounted && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
            Loading map
          </div>
        )}
        {isMobile && mobilePoint && (
          <div className="absolute inset-x-3 bottom-3 z-20 rounded-xl border bg-[hsl(var(--background))] shadow-2xl">
            <button
              type="button"
              aria-label="Close location details"
              onClick={() => setMobilePoint(null)}
              className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <LocationPopupCard point={mobilePoint} className="w-full" />
          </div>
        )}
      </div>
      <div className="grid content-start gap-2 lg:max-h-[var(--location-map-list-height,40rem)] lg:overflow-y-auto lg:pr-1">
        {mappedPoints.map((point) => (
          <a
            key={point.id}
            href={`/locations/${point.slug}`}
            className="group grid grid-cols-[3rem_minmax(0,1fr)] gap-3 rounded-lg border bg-[hsl(var(--background))] p-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
          >
            <div className="relative h-12 w-12 overflow-hidden rounded-md bg-[hsl(var(--muted))]">
              {point.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={point.coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <MapPin className="m-3 h-6 w-6 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{point.name}</p>
              <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                {point.region || `${point.photoCount} ${point.photoCount === 1 ? "photo" : "photos"}`}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
