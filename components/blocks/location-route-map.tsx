"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import maplibregl, { type Map as MapLibreMap, type Marker } from "maplibre-gl";
import { Clock, ExternalLink, Loader2, MapPin, Navigation, Route, X } from "lucide-react";
import type { LeafBlock } from "@/src/lib/blocks";
import { cn } from "@/src/lib/utils";
import {
  LocationPopupCard,
  type LocationMapPoint,
} from "@/components/blocks/location-map-client";

type LocationMapBlock = Extract<LeafBlock, { type: "locationMap" }>;

interface RouteOption {
  id: string;
  coordinates: [number, number][];
  duration: number;
  distance: number;
  source: "osrm" | "estimated";
}

interface RouteLayerEvent {
  layerId: string;
  type: "click" | "mouseenter" | "mouseleave";
  handler: () => void;
}

interface RouteOverlayPath {
  id: string;
  index: number;
  d: string;
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

const ROUTE_LAYER_PREFIX = "location-route-layer";
const ROUTE_SOURCE_PREFIX = "location-route-source";

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

function formatDuration(seconds: number) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

type RouteTravelMode = NonNullable<LocationMapBlock["routeTravelMode"]>;
type RouteSummaryPosition = NonNullable<LocationMapBlock["routeSummaryPosition"]>;
type RouteSummaryStyle = NonNullable<LocationMapBlock["routeSummaryStyle"]>;

const TRAVEL_MODE_LABEL: Record<RouteTravelMode, string> = {
  driving: "Driving",
  walking: "Walking",
  cycling: "Cycling",
};

const GOOGLE_TRAVEL_MODE: Record<RouteTravelMode, string> = {
  driving: "driving",
  walking: "walking",
  cycling: "bicycling",
};

const APPLE_DIR_FLAG: Record<RouteTravelMode, string> = {
  driving: "d",
  walking: "w",
  cycling: "b",
};

const ESTIMATED_SPEED: Record<RouteTravelMode, number> = {
  driving: 15,
  walking: 1.4,
  cycling: 5,
};

const SUMMARY_POSITION_CLASS: Record<RouteSummaryPosition, string> = {
  "top-left": "left-3 top-3",
  "top-right": "right-3 top-3 items-end",
  "bottom-left": "bottom-3 left-3",
  "bottom-right": "bottom-3 right-3 items-end",
};

function stopPanelPositionClass(summaryPosition: RouteSummaryPosition) {
  return summaryPosition.endsWith("right") ? "left-3 top-3" : "right-3 top-3";
}

function routeTravelMode(block: LocationMapBlock): RouteTravelMode {
  return block.routeTravelMode ?? "driving";
}

function coordinateText(point: LocationMapPoint) {
  return `${point.lat},${point.lng}`;
}

function googleMapsRouteHref(points: LocationMapPoint[], travelMode: RouteTravelMode) {
  if (points.length < 2) return null;
  const [origin, ...rest] = points;
  const destination = rest[rest.length - 1];
  const waypoints = rest.slice(0, -1);
  const params = new URLSearchParams({
    api: "1",
    origin: coordinateText(origin),
    destination: coordinateText(destination),
    travelmode: GOOGLE_TRAVEL_MODE[travelMode],
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.map(coordinateText).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function appleMapsRouteHref(points: LocationMapPoint[], travelMode: RouteTravelMode) {
  if (points.length < 2) return null;
  const [origin, ...destinations] = points;
  const params = new URLSearchParams({
    saddr: coordinateText(origin),
    daddr: destinations.map(coordinateText).join(" to "),
    dirflg: APPLE_DIR_FLAG[travelMode],
  });
  return `https://maps.apple.com/?${params.toString()}`;
}

function metersBetween(a: LocationMapPoint, b: LocationMapPoint) {
  const radius = 6371000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function estimatedRoute(
  points: LocationMapPoint[],
  travelMode: RouteTravelMode,
  id = "estimated-0",
): RouteOption {
  const coordinates = points.map((point) => [point.lng, point.lat] as [number, number]);
  const distance = points.slice(1).reduce(
    (sum, point, index) => sum + metersBetween(points[index], point),
    0,
  );
  return {
    id,
    coordinates,
    distance,
    duration: distance / ESTIMATED_SPEED[travelMode],
    source: "estimated",
  };
}

function simplifyRouteCoordinates(
  coordinates: [number, number][],
  stops: LocationMapPoint[],
  maxPoints = 1600,
) {
  if (coordinates.length <= maxPoints) return coordinates;

  const keep = new Set<number>([0, coordinates.length - 1]);
  for (const stop of stops) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    coordinates.forEach(([lng, lat], index) => {
      const distance = (lng - stop.lng) ** 2 + (lat - stop.lat) ** 2;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    keep.add(nearestIndex);
  }

  const stride = Math.ceil(coordinates.length / maxPoints);
  for (let index = 0; index < coordinates.length; index += stride) {
    keep.add(index);
  }

  return [...keep]
    .sort((a, b) => a - b)
    .map((index) => coordinates[index]);
}

function projectRoutePath(map: MapLibreMap, coordinates: [number, number][]) {
  return coordinates
    .map((coordinate, index) => {
      const point = map.project(coordinate);
      return `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function fitCoordinates(
  map: MapLibreMap,
  coordinates: [number, number][],
  reduceMotion: boolean,
  isMobile: boolean,
  showCards: boolean,
  showStopList: boolean,
  summaryPosition: RouteSummaryPosition,
) {
  if (coordinates.length === 0) return;
  if (coordinates.length === 1) {
    map.easeTo({
      center: coordinates[0],
      zoom: 10,
      duration: reduceMotion ? 0 : 650,
    });
    return;
  }
  const bounds = new maplibregl.LngLatBounds();
  coordinates.forEach((coordinate) => bounds.extend(coordinate));
  const summaryOnLeft = summaryPosition.endsWith("left");
  const summaryOnRight = summaryPosition.endsWith("right");
  map.fitBounds(bounds, {
    padding: isMobile
      ? { top: showStopList ? 128 : 72, right: 48, bottom: showCards ? 118 : 64, left: 48 }
      : {
          top: showStopList ? 118 : 84,
          right: showStopList || (showCards && summaryOnRight) ? 220 : 76,
          bottom: showCards && summaryPosition.startsWith("bottom") ? 118 : 86,
          left: showCards && summaryOnLeft ? 220 : 76,
        },
    maxZoom: 13,
    duration: reduceMotion ? 0 : 750,
  });
}

function clearRouteLayers(
  map: MapLibreMap,
  routeIds: string[],
  events: RouteLayerEvent[],
) {
  events.forEach((event) => {
    map.off(event.type, event.layerId, event.handler);
  });
  routeIds.forEach((routeId) => {
    const layerId = `${ROUTE_LAYER_PREFIX}-${routeId}`;
    const casingLayerId = `${layerId}-casing`;
    const sourceId = `${ROUTE_SOURCE_PREFIX}-${routeId}`;
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getLayer(casingLayerId)) map.removeLayer(casingLayerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  });
}

function resolveRouteStops(block: LocationMapBlock, mappedPoints: LocationMapPoint[]) {
  const pointById = new Map(mappedPoints.map((point) => [point.id, point]));
  const explicitStops = (block.routePointIds ?? [])
    .map((id) => pointById.get(id))
    .filter((point): point is LocationMapPoint => Boolean(point));
  const orderedStops = explicitStops.length > 0 ? explicitStops : mappedPoints;

  if ((block.routeStyle ?? "planning") === "basic") return orderedStops;

  const start: LocationMapPoint | null =
    pointById.get(block.routeStartId) ?? orderedStops[0] ?? null;
  let end: LocationMapPoint | null =
    pointById.get(block.routeEndId) ??
    orderedStops[orderedStops.length - 1] ??
    null;
  if (start && end?.id === start.id) {
    end =
      orderedStops.find((point) => point.id !== start.id) ??
      mappedPoints.find((point) => point.id !== start.id) ??
      null;
  }
  if (!start || !end) return [];
  const stopsBetween = explicitStops.filter(
    (point) => point.id !== start.id && point.id !== end.id,
  );
  return [start, ...stopsBetween, end];
}

function routeMarkerColor(block: LocationMapBlock, index: number, total: number) {
  const isPlanning = (block.routeStyle ?? "planning") === "planning";
  if (!isPlanning) return block.markerColor;
  if (index === 0) return block.routeStartColor;
  if (index === total - 1) return block.routeEndColor;
  return block.markerColor;
}

function routeStopRole(block: LocationMapBlock, index: number, total: number) {
  if ((block.routeStyle ?? "planning") !== "planning") return "Route stop";
  if (index === 0) return "Start";
  if (index === total - 1) return "End";
  return "Stop between";
}

function addRouteMarkers({
  map,
  routeStops,
  block,
  isMobile,
  onMobilePoint,
  popupRoots,
}: {
  map: MapLibreMap;
  routeStops: LocationMapPoint[];
  block: LocationMapBlock;
  isMobile: boolean;
  onMobilePoint: (point: LocationMapPoint | null) => void;
  popupRoots: Root[];
}) {
  return routeStops.map((point, index) => {
    const isEnd = index === routeStops.length - 1;
    const el = document.createElement("button");
    el.type = "button";
    el.className =
      "location-route-marker group relative flex h-5 w-5 items-center justify-center rounded-full bg-transparent p-0";
    el.setAttribute("aria-label", point.name);

    const dot = document.createElement("span");
    dot.className =
      "flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white shadow-lg";
    dot.style.background = routeMarkerColor(block, index, routeStops.length);
    dot.textContent = String(index + 1);
    el.append(dot);

    if (block.routeShowLabels ?? true) {
      const label = document.createElement("span");
      label.className = cn(
        "pointer-events-none absolute left-1/2 whitespace-nowrap rounded-md border bg-[hsl(var(--background))]/95 px-2 py-1 text-xs font-medium text-[hsl(var(--foreground))] shadow-sm backdrop-blur",
        (block.routeStyle ?? "planning") === "planning" && isEnd
          ? "top-6 -translate-x-1/2"
          : "bottom-6 -translate-x-1/2",
      );
      label.textContent = point.name;
      el.append(label);
    }

    if (isMobile) {
      el.addEventListener("click", (event) => {
        event.preventDefault();
        onMobilePoint(point);
        map.easeTo({ center: [point.lng, point.lat], duration: 350 });
      });
    } else {
      const popupContainer = document.createElement("div");
      const popupRoot = createRoot(popupContainer);
      popupRoot.render(<LocationPopupCard point={point} />);
      popupRoots.push(popupRoot);
      const popup = new maplibregl.Popup({
        offset: 18,
        closeButton: false,
        maxWidth: "none",
      }).setDOMContent(popupContainer);
      let closeTimer: number | null = null;
      const clearClose = () => {
        if (!closeTimer) return;
        window.clearTimeout(closeTimer);
        closeTimer = null;
      };
      const openPopup = () => {
        clearClose();
        popup.setLngLat([point.lng, point.lat]).addTo(map);
      };
      const scheduleClose = () => {
        clearClose();
        closeTimer = window.setTimeout(() => popup.remove(), 220);
      };
      el.addEventListener("mouseenter", openPopup);
      el.addEventListener("mouseleave", scheduleClose);
      el.addEventListener("click", openPopup);
      popupContainer.addEventListener("mouseenter", clearClose);
      popupContainer.addEventListener("mouseleave", scheduleClose);
    }

    return new maplibregl.Marker({ element: el, anchor: "center" })
      .setLngLat([point.lng, point.lat])
      .addTo(map);
  });
}

function RouteChoiceButton({
  route,
  index,
  isActive,
  isFastest,
  summaryStyle,
  travelMode,
  onClick,
}: {
  route: RouteOption;
  index: number;
  isActive: boolean;
  isFastest: boolean;
  summaryStyle: RouteSummaryStyle;
  travelMode: RouteTravelMode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center justify-start gap-3 rounded-md border px-3 py-2 text-left text-sm font-medium shadow-sm transition",
        summaryStyle === "solid" &&
          (isActive
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-[hsl(var(--background))]/90 text-[hsl(var(--foreground))] backdrop-blur hover:bg-[hsl(var(--muted))]"),
        summaryStyle === "glass" &&
          (isActive
            ? "border-primary/70 bg-primary/85 text-primary-foreground backdrop-blur-md"
            : "border-white/50 bg-[hsl(var(--background))]/70 text-[hsl(var(--foreground))] backdrop-blur-md hover:bg-[hsl(var(--background))]/90"),
        summaryStyle === "minimal" &&
          (isActive
            ? "border-primary/60 bg-[hsl(var(--background))]/90 text-[hsl(var(--foreground))] ring-1 ring-primary/30"
            : "border-transparent bg-[hsl(var(--background))]/70 text-[hsl(var(--foreground))] shadow-none backdrop-blur hover:bg-[hsl(var(--background))]/95"),
      )}
    >
      <span className="text-xs opacity-80">{TRAVEL_MODE_LABEL[travelMode]}</span>
      <span className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        {formatDuration(route.duration)}
      </span>
      <span className="flex items-center gap-1.5 text-xs opacity-80">
        <Route className="h-3 w-3" aria-hidden="true" />
        {formatDistance(route.distance)}
      </span>
      {isFastest && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium",
            isActive
              ? "bg-white/20 text-current"
              : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
          )}
        >
          Fastest
        </span>
      )}
      {route.source === "estimated" && index === 0 && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium",
            isActive
              ? "bg-white/20 text-current"
              : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
          )}
        >
          Estimated
        </span>
      )}
    </button>
  );
}

function RoutePlanPanel({
  block,
  routeStops,
  variant,
  onSelectStop,
}: {
  block: LocationMapBlock;
  routeStops: LocationMapPoint[];
  variant: "desktop" | "mobile";
  onSelectStop: (point: LocationMapPoint) => void;
}) {
  const showStopList = block.routeShowStopList ?? true;
  const showMapLinks = block.routeShowMapLinks ?? true;
  const travelMode = routeTravelMode(block);
  const googleHref = googleMapsRouteHref(routeStops, travelMode);
  const appleHref = appleMapsRouteHref(routeStops, travelMode);

  if (!showStopList && !showMapLinks) return null;

  return (
    <div
      className={cn(
        "rounded-xl border bg-[hsl(var(--background))]/95 text-[hsl(var(--foreground))] shadow-xl backdrop-blur-md",
        variant === "desktop" ? "hidden w-72 flex-col gap-3 p-3 sm:flex" : "space-y-2 p-2 sm:hidden",
      )}
    >
      {showStopList && (
        <ol
          className={cn(
            variant === "desktop" ? "space-y-1.5" : "flex gap-2 overflow-x-auto pb-1",
          )}
          aria-label="Route stops"
        >
          {routeStops.map((point, index) => (
            <li key={`${point.id}-${index}`} className={variant === "mobile" ? "min-w-[9rem]" : undefined}>
              <button
                type="button"
                onClick={() => onSelectStop(point)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-left transition hover:border-border hover:bg-[hsl(var(--muted))]",
                  variant === "mobile" && "bg-[hsl(var(--background))]/80 shadow-sm",
                )}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-white shadow"
                  style={{ background: routeMarkerColor(block, index, routeStops.length) }}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    {routeStopRole(block, index, routeStops.length)}
                  </span>
                  <span className="block truncate text-sm font-medium">{point.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {showMapLinks && (googleHref || appleHref) && (
        <div className="grid grid-cols-2 gap-2">
          {googleHref && (
            <a
              href={googleHref}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
              Google
            </a>
          )}
          {appleHref && (
            <a
              href={appleHref}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border bg-[hsl(var(--background))] px-2 text-xs font-medium shadow-sm transition hover:bg-[hsl(var(--muted))]"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Apple
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function LocationRouteMap({
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
  const routeLayerIdsRef = useRef<string[]>([]);
  const routeLayerEventsRef = useRef<RouteLayerEvent[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePoint, setMobilePoint] = useState<LocationMapPoint | null>(null);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [routeOverlayPaths, setRouteOverlayPaths] = useState<RouteOverlayPath[]>([]);
  const mappedPoints = useMemo(
    () => points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)),
    [points],
  );
  const routeStops = useMemo(
    () => resolveRouteStops(block, mappedPoints),
    [block, mappedPoints],
  );
  const showCards = block.routeShowCards ?? true;
  const showStopList = block.routeShowStopList ?? true;
  const summaryPosition = block.routeSummaryPosition ?? "top-left";
  const summaryStyle = block.routeSummaryStyle ?? "solid";
  const travelMode = routeTravelMode(block);

  useEffect(() => {
    setIsMounted(true);
    const query = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || routeStops.length < 2) return;
    const first = routeStops[0];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl(block.mapTheme),
      center: [first.lng, first.lat],
      zoom: routeStops.length === 2 ? 8.5 : 11,
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
    return () => {
      clearRouteLayers(map, routeLayerIdsRef.current, routeLayerEventsRef.current);
      routeLayerIdsRef.current = [];
      routeLayerEventsRef.current = [];
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      popupRootsRef.current.forEach((root) => root.unmount());
      popupRootsRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // Initialize the map once; style, route layers, and markers sync below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeStops.length]);

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
    if (routeStops.length < 2) {
      setRoutes([]);
      setIsLoading(false);
      return;
    }

    setSelectedIndex(0);
    if ((block.routeStyle ?? "planning") === "basic" || block.routeProvider === "straight") {
      setRoutes([estimatedRoute(routeStops, travelMode)]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    const alternatives = block.routeShowAlternatives ?? true;
    const osrmCoordinates = routeStops
      .map((point) => `${point.lng},${point.lat}`)
      .join(";");
    const url = `https://router.project-osrm.org/route/v1/${travelMode}/${osrmCoordinates}?overview=full&geometries=geojson&alternatives=${alternatives ? "true" : "false"}`;

    async function loadRoutes() {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Route request failed");
        const data = (await response.json()) as {
          routes?: Array<{
            geometry?: { coordinates?: [number, number][] };
            duration?: number;
            distance?: number;
          }>;
        };
        const nextRoutes = (data.routes ?? [])
          .map((route, index): RouteOption | null => {
            if (!route.geometry?.coordinates?.length) return null;
            return {
              id: `osrm-${index}`,
              coordinates: simplifyRouteCoordinates(route.geometry.coordinates, routeStops),
              duration: route.duration ?? 0,
              distance: route.distance ?? 0,
              source: "osrm",
            };
          })
          .filter((route): route is RouteOption => Boolean(route));
        setRoutes(nextRoutes.length > 0 ? nextRoutes : [estimatedRoute(routeStops, travelMode)]);
      } catch {
        if (!controller.signal.aborted) setRoutes([estimatedRoute(routeStops, travelMode)]);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    loadRoutes();
    return () => controller.abort();
  }, [
    block.routeProvider,
    block.routeShowAlternatives,
    block.routeStyle,
    routeStops,
    travelMode,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const syncLayers = () => {
      if (!map.isStyleLoaded()) return;
      clearRouteLayers(map, routeLayerIdsRef.current, routeLayerEventsRef.current);
      routeLayerIdsRef.current = [];
      routeLayerEventsRef.current = [];

      const sortedRoutes = routes
        .map((route, index) => ({ route, index }))
        .sort((a, b) => {
          if (a.index === selectedIndex) return 1;
          if (b.index === selectedIndex) return -1;
          return 0;
        });

      sortedRoutes.forEach(({ route, index }) => {
        const isSelected = index === selectedIndex;
        const sourceId = `${ROUTE_SOURCE_PREFIX}-${route.id}`;
        const layerId = `${ROUTE_LAYER_PREFIX}-${route.id}`;
        const casingLayerId = `${layerId}-casing`;
        map.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: route.coordinates,
            },
          },
        });
        map.addLayer({
          id: casingLayerId,
          type: "line",
          source: sourceId,
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": isSelected ? "#ffffff" : "#0f172a",
            "line-width": isSelected ? 15 : 12,
            "line-opacity": 0.01,
            "line-blur": isSelected ? 0.5 : 0.75,
          },
        });
        map.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": isSelected
              ? block.routeLineColor
              : block.routeInactiveLineColor,
            "line-width": isSelected ? 11 : 9,
            "line-opacity": 0.01,
          },
        });

        const clickHandler = () => setSelectedIndex(index);
        const enterHandler = () => {
          map.getCanvas().style.cursor = "pointer";
        };
        const leaveHandler = () => {
          map.getCanvas().style.cursor = "";
        };
        map.on("click", layerId, clickHandler);
        map.on("click", casingLayerId, clickHandler);
        map.on("mouseenter", layerId, enterHandler);
        map.on("mouseenter", casingLayerId, enterHandler);
        map.on("mouseleave", layerId, leaveHandler);
        map.on("mouseleave", casingLayerId, leaveHandler);
        routeLayerEventsRef.current.push(
          { layerId, type: "click", handler: clickHandler },
          { layerId: casingLayerId, type: "click", handler: clickHandler },
          { layerId, type: "mouseenter", handler: enterHandler },
          { layerId: casingLayerId, type: "mouseenter", handler: enterHandler },
          { layerId, type: "mouseleave", handler: leaveHandler },
          { layerId: casingLayerId, type: "mouseleave", handler: leaveHandler },
        );
        routeLayerIdsRef.current.push(route.id);
      });
    };

    let frame = 0;
    const scheduleSync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(syncLayers);
    };
    if (map.isStyleLoaded()) syncLayers();
    map.on("load", scheduleSync);
    map.on("style.load", scheduleSync);

    return () => {
      window.cancelAnimationFrame(frame);
      map.off("load", scheduleSync);
      map.off("style.load", scheduleSync);
      clearRouteLayers(map, routeLayerIdsRef.current, routeLayerEventsRef.current);
      routeLayerIdsRef.current = [];
      routeLayerEventsRef.current = [];
    };
  }, [
    block.routeInactiveLineColor,
    block.routeLineColor,
    routes,
    selectedIndex,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || routes.length === 0) {
      setRouteOverlayPaths([]);
      return;
    }

    let frame = 0;
    const updateOverlay = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setRouteOverlayPaths(
          routes.map((route, index) => ({
            id: route.id,
            index,
            d: projectRoutePath(map, route.coordinates),
          })),
        );
      });
    };

    updateOverlay();
    map.on("move", updateOverlay);
    map.on("resize", updateOverlay);
    map.on("pitch", updateOverlay);
    map.on("rotate", updateOverlay);

    return () => {
      window.cancelAnimationFrame(frame);
      map.off("move", updateOverlay);
      map.off("resize", updateOverlay);
      map.off("pitch", updateOverlay);
      map.off("rotate", updateOverlay);
    };
  }, [routes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    popupRootsRef.current.forEach((root) => root.unmount());
    popupRootsRef.current = [];
    const addMarkers = () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      popupRootsRef.current.forEach((root) => root.unmount());
      popupRootsRef.current = [];
      markersRef.current = addRouteMarkers({
        map,
        routeStops,
        block,
        isMobile,
        onMobilePoint: setMobilePoint,
        popupRoots: popupRootsRef.current,
      });
    };
    if (map.isStyleLoaded()) addMarkers();
    map.on("load", addMarkers);
    map.on("style.load", addMarkers);
    return () => {
      map.off("load", addMarkers);
      map.off("style.load", addMarkers);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      popupRootsRef.current.forEach((root) => root.unmount());
      popupRootsRef.current = [];
    };
  }, [block, isMobile, routeStops]);

  useEffect(() => {
    const map = mapRef.current;
    const activeRoute = routes[selectedIndex] ?? routes[0];
    const coordinates =
      activeRoute?.coordinates ??
      routeStops.map((point) => [point.lng, point.lat] as [number, number]);
    if (!map || coordinates.length < 2) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fit = () =>
      fitCoordinates(
        map,
        coordinates,
        reduceMotion,
        isMobile,
        showCards,
        showStopList,
        summaryPosition,
      );
    if (map.isStyleLoaded()) fit();
    else map.once("load", fit);
    return () => {
      map.off("load", fit);
    };
  }, [isMobile, routeStops, routes, selectedIndex, showCards, showStopList, summaryPosition]);

  const focusStop = (point: LocationMapPoint) => {
    const map = mapRef.current;
    if (map) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map.easeTo({
        center: [point.lng, point.lat],
        zoom: Math.max(map.getZoom(), isMobile ? 8.5 : 10),
        duration: reduceMotion ? 0 : 420,
      });
    }
    if (isMobile) setMobilePoint(point);
  };

  if (routeStops.length < 2) {
    return (
      <div className="rounded-xl border bg-[hsl(var(--muted))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
        Add at least two mapped locations or custom pins to show a route.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "location-route-map relative min-w-0 overflow-hidden rounded-xl border bg-[hsl(var(--muted))] shadow-sm",
        HEIGHT_CLASS[block.height],
      )}
    >
      <div ref={containerRef} className="absolute inset-0" aria-hidden={!isMounted} />
      {!isMounted && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
          Loading map
        </div>
      )}
      {routeOverlayPaths.length > 0 && (
        <svg
          className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
          aria-hidden="true"
        >
          {routeOverlayPaths
            .filter((path) => path.index !== selectedIndex)
            .map((path) => (
              <g key={path.id}>
                <path
                  d={path.d}
                  fill="none"
                  stroke="#ffffff"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={0.36}
                  strokeWidth={8}
                />
                <path
                  d={path.d}
                  fill="none"
                  stroke={block.routeInactiveLineColor}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={0.76}
                  strokeWidth={4.5}
                />
              </g>
            ))}
          {routeOverlayPaths
            .filter((path) => path.index === selectedIndex)
            .map((path) => (
              <g key={path.id}>
                <path
                  d={path.d}
                  fill="none"
                  stroke="#ffffff"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={0.84}
                  strokeWidth={11}
                />
                <path
                  d={path.d}
                  fill="none"
                  stroke={block.routeLineColor}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={6.5}
                />
              </g>
            ))}
        </svg>
      )}
      <div className={cn("absolute z-10 hidden sm:block", stopPanelPositionClass(summaryPosition))}>
        <RoutePlanPanel
          block={block}
          routeStops={routeStops}
          variant="desktop"
          onSelectStop={focusStop}
        />
      </div>
      <div className="absolute inset-x-3 top-3 z-10 sm:hidden">
        <RoutePlanPanel
          block={block}
          routeStops={routeStops}
          variant="mobile"
          onSelectStop={focusStop}
        />
      </div>
      {isMobile && mobilePoint && (
        <div className="absolute inset-x-3 bottom-16 z-20 rounded-xl border bg-[hsl(var(--background))] shadow-2xl sm:hidden">
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
      {showCards && routes.length > 0 && (
        <>
          <div className={cn(
            "absolute z-10 hidden max-w-[calc(100%-1.5rem)] flex-col gap-2 sm:flex",
            SUMMARY_POSITION_CLASS[summaryPosition],
          )}>
            {routes.map((route, index) => (
              <RouteChoiceButton
                key={route.id}
                route={route}
                index={index}
                isActive={index === selectedIndex}
                isFastest={(block.routeStyle ?? "planning") === "planning" && index === 0}
                summaryStyle={summaryStyle}
                travelMode={travelMode}
                onClick={() => setSelectedIndex(index)}
              />
            ))}
          </div>
          <div className="absolute inset-x-3 bottom-3 z-10 flex gap-2 overflow-x-auto pb-1 sm:hidden">
            {routes.map((route, index) => (
              <RouteChoiceButton
                key={route.id}
                route={route}
                index={index}
                isActive={index === selectedIndex}
                isFastest={(block.routeStyle ?? "planning") === "planning" && index === 0}
                summaryStyle={summaryStyle}
                travelMode={travelMode}
                onClick={() => setSelectedIndex(index)}
              />
            ))}
          </div>
        </>
      )}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[hsl(var(--background))]/50 backdrop-blur-[1px]">
          <div className="inline-flex items-center gap-2 rounded-full border bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading routes
          </div>
        </div>
      )}
      {routes.length === 0 && !isLoading && (
        <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-md border bg-[hsl(var(--background))]/90 px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] shadow-sm backdrop-blur">
          <MapPin className="h-4 w-4" aria-hidden="true" />
          Route unavailable
        </div>
      )}
    </div>
  );
}
