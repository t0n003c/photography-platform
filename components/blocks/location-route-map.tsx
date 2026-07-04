"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap, type Marker } from "maplibre-gl";
import { Clock, Loader2, MapPin, Route } from "lucide-react";
import type { LeafBlock } from "@/src/lib/blocks";
import { cn } from "@/src/lib/utils";
import type { LocationMapPoint } from "@/components/blocks/location-map-client";

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

function estimatedRoute(points: LocationMapPoint[], id = "estimated-0"): RouteOption {
  const coordinates = points.map((point) => [point.lng, point.lat] as [number, number]);
  const distance = points.slice(1).reduce(
    (sum, point, index) => sum + metersBetween(points[index], point),
    0,
  );
  return {
    id,
    coordinates,
    distance,
    duration: distance / 15,
    source: "estimated",
  };
}

function fitCoordinates(
  map: MapLibreMap,
  coordinates: [number, number][],
  reduceMotion: boolean,
  isMobile: boolean,
  showCards: boolean,
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
  map.fitBounds(bounds, {
    padding: isMobile
      ? { top: 72, right: 48, bottom: showCards ? 118 : 64, left: 48 }
      : { top: 84, right: 76, bottom: 86, left: showCards ? 210 : 76 },
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
    const sourceId = `${ROUTE_SOURCE_PREFIX}-${routeId}`;
    if (map.getLayer(layerId)) map.removeLayer(layerId);
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
    end = orderedStops.find((point) => point.id !== start.id) ?? null;
  }
  return start && end ? [start, end] : [];
}

function addRouteMarkers({
  map,
  routeStops,
  block,
}: {
  map: MapLibreMap;
  routeStops: LocationMapPoint[];
  block: LocationMapBlock;
}) {
  return routeStops.map((point, index) => {
    const isPlanning = (block.routeStyle ?? "planning") === "planning";
    const isStart = index === 0;
    const isEnd = index === routeStops.length - 1;
    const el = document.createElement("button");
    el.type = "button";
    el.className =
      "location-route-marker group relative flex h-5 w-5 items-center justify-center rounded-full bg-transparent p-0";
    el.setAttribute("aria-label", point.name);

    const dot = document.createElement("span");
    dot.className =
      "flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white shadow-lg";
    dot.style.background = isPlanning
      ? isStart
        ? block.routeStartColor
        : block.routeEndColor
      : block.markerColor;
    dot.textContent = isPlanning ? "" : String(index + 1);
    el.append(dot);

    if (block.routeShowLabels ?? true) {
      const label = document.createElement("span");
      label.className = cn(
        "pointer-events-none absolute left-1/2 whitespace-nowrap rounded-md border bg-[hsl(var(--background))]/95 px-2 py-1 text-xs font-medium text-[hsl(var(--foreground))] shadow-sm backdrop-blur",
        isPlanning && isEnd
          ? "top-6 -translate-x-1/2"
          : "bottom-6 -translate-x-1/2",
      );
      label.textContent = point.name;
      el.append(label);
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
  onClick,
}: {
  route: RouteOption;
  index: number;
  isActive: boolean;
  isFastest: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center justify-start gap-3 rounded-md border px-3 py-2 text-left text-sm font-medium shadow-sm transition",
        isActive
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-[hsl(var(--background))]/90 text-[hsl(var(--foreground))] backdrop-blur hover:bg-[hsl(var(--muted))]",
      )}
    >
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
  const routeLayerIdsRef = useRef<string[]>([]);
  const routeLayerEventsRef = useRef<RouteLayerEvent[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const mappedPoints = useMemo(
    () => points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)),
    [points],
  );
  const routeStops = useMemo(
    () => resolveRouteStops(block, mappedPoints),
    [block, mappedPoints],
  );
  const showCards = block.routeShowCards ?? true;

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
      setRoutes([estimatedRoute(routeStops)]);
      setIsLoading(false);
      return;
    }

    const [start, end] = routeStops;
    const controller = new AbortController();
    setIsLoading(true);
    const alternatives = block.routeShowAlternatives ?? true;
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=${alternatives ? "true" : "false"}`;

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
              coordinates: route.geometry.coordinates,
              duration: route.duration ?? 0,
              distance: route.distance ?? 0,
              source: "osrm",
            };
          })
          .filter((route): route is RouteOption => Boolean(route));
        setRoutes(nextRoutes.length > 0 ? nextRoutes : [estimatedRoute(routeStops)]);
      } catch {
        if (!controller.signal.aborted) setRoutes([estimatedRoute(routeStops)]);
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
            "line-width": isSelected ? 6 : 5,
            "line-opacity": isSelected ? 1 : 0.62,
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
        map.on("mouseenter", layerId, enterHandler);
        map.on("mouseleave", layerId, leaveHandler);
        routeLayerEventsRef.current.push(
          { layerId, type: "click", handler: clickHandler },
          { layerId, type: "mouseenter", handler: enterHandler },
          { layerId, type: "mouseleave", handler: leaveHandler },
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
    map.on("styledata", scheduleSync);

    return () => {
      window.cancelAnimationFrame(frame);
      map.off("load", scheduleSync);
      map.off("styledata", scheduleSync);
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
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    const addMarkers = () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = addRouteMarkers({ map, routeStops, block });
    };
    if (map.isStyleLoaded()) addMarkers();
    map.on("styledata", addMarkers);
    return () => {
      map.off("styledata", addMarkers);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [block, routeStops]);

  useEffect(() => {
    const map = mapRef.current;
    const activeRoute = routes[selectedIndex] ?? routes[0];
    const coordinates =
      activeRoute?.coordinates ??
      routeStops.map((point) => [point.lng, point.lat] as [number, number]);
    if (!map || coordinates.length < 2) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fit = () => fitCoordinates(map, coordinates, reduceMotion, isMobile, showCards);
    if (map.isStyleLoaded()) fit();
    else map.once("load", fit);
    return () => {
      map.off("load", fit);
    };
  }, [isMobile, routeStops, routes, selectedIndex, showCards]);

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
      {showCards && routes.length > 0 && (
        <>
          <div className="absolute left-3 top-3 z-10 hidden max-w-[calc(100%-1.5rem)] flex-col gap-2 sm:flex">
            {routes.map((route, index) => (
              <RouteChoiceButton
                key={route.id}
                route={route}
                index={index}
                isActive={index === selectedIndex}
                isFastest={(block.routeStyle ?? "planning") === "planning" && index === 0}
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
