import DottedMap from "dotted-map";
import type { CSSProperties } from "react";
import type { LeafBlock } from "@/src/lib/blocks";
import type { LocationMapPoint } from "@/components/blocks/location-map-client";

type LocationMapBlockConfig = Extract<LeafBlock, { type: "locationMap" }>;

interface ProjectedPoint extends LocationMapPoint {
  x: number;
  y: number;
}

interface DotPoint {
  x: number;
  y: number;
}

const MAP_HEIGHT = 60;

function createMap() {
  return new DottedMap({
    height: MAP_HEIGHT,
    grid: "diagonal",
    projection: { name: "robinson" },
  });
}

function linkProps(href: string) {
  if (!/^https?:\/\//i.test(href)) return {};
  return { target: "_blank", rel: "noreferrer noopener" };
}

function shorten(label: string) {
  return label.length > 20 ? `${label.slice(0, 19)}...` : label;
}

function projectPoints(points: LocationMapPoint[]) {
  const map = createMap();
  points.forEach((point) => {
    map.addPin({
      lat: point.lat,
      lng: point.lng,
      svgOptions: { color: "currentColor", radius: 0.48 },
      data: { id: point.id },
    });
  });

  const rawPoints = map.getPoints() as Array<
    DotPoint & {
      data?: { id?: string };
    }
  >;
  const pointById = new Map(points.map((point) => [point.id, point]));
  const projected = new Map<string, ProjectedPoint>();
  const dots: DotPoint[] = [];

  rawPoints.forEach((point) => {
    const id = point.data?.id;
    if (id && pointById.has(id)) {
      projected.set(id, {
        ...pointById.get(id)!,
        x: point.x,
        y: point.y,
      });
      return;
    }
    dots.push({ x: point.x, y: point.y });
  });

  return {
    dots,
    projectedPoints: points
      .map((point) => projected.get(point.id))
      .filter((point): point is ProjectedPoint => Boolean(point)),
    width: Math.ceil(Math.max(...rawPoints.map((point) => point.x), 1)),
    height: Math.ceil(Math.max(...rawPoints.map((point) => point.y), MAP_HEIGHT)),
  };
}

function resolveConnections(
  block: LocationMapBlockConfig,
  projectedPoints: ProjectedPoint[],
) {
  if (projectedPoints.length < 2) return [];
  const connectionMode = block.networkConnectionMode ?? "ordered";
  if (connectionMode === "hub") {
    const [hub, ...rest] = projectedPoints;
    return rest.map((point, index) => ({
      id: `hub-${hub.id}-${point.id}-${index}`,
      start: hub,
      end: point,
    }));
  }
  if (connectionMode === "manual") {
    const pointById = new Map(projectedPoints.map((point) => [point.id, point]));
    return (block.networkConnections ?? [])
      .map((connection) => {
        const start = pointById.get(connection.startId);
        const end = pointById.get(connection.endId);
        if (!start || !end || start.id === end.id) return null;
        return {
          id: connection.id,
          start,
          end,
        };
      })
      .filter(
        (connection): connection is { id: string; start: ProjectedPoint; end: ProjectedPoint } =>
          Boolean(connection),
      );
  }
  return projectedPoints.slice(1).map((point, index) => ({
    id: `ordered-${projectedPoints[index].id}-${point.id}`,
    start: projectedPoints[index],
    end: point,
  }));
}

function arcPath(start: ProjectedPoint, end: ProjectedPoint, index: number) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  const lift = Math.min(16, Math.max(4.5, distance * 0.18));
  const direction = index % 2 === 0 ? -1 : 1;
  const controlX = (start.x + end.x) / 2;
  const controlY = (start.y + end.y) / 2 + lift * direction;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} Q ${controlX.toFixed(2)} ${controlY.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function LocationDottedNetworkMap({
  block,
  points,
}: {
  block: LocationMapBlockConfig;
  points: LocationMapPoint[];
}) {
  const mappedPoints = points.filter(
    (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng),
  );
  if (mappedPoints.length === 0) {
    return (
      <div className="rounded-xl border bg-[hsl(var(--muted))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
        Add latitude and longitude to locations or custom pins to show them on this map.
      </div>
    );
  }

  const { dots, projectedPoints, width, height } = projectPoints(mappedPoints);
  const connections = resolveConnections(block, projectedPoints);
  const style = {
    "--location-network-line": block.networkLineColor ?? "#0ea5e9",
    "--location-network-dot": block.networkDotColor ?? "#f43f5e",
    "--location-network-map-dot": block.networkMapDotColor ?? "#94a3b8",
    "--location-network-speed": `${block.networkAnimationSeconds ?? 3.2}s`,
  } as CSSProperties;

  return (
    <div
      className="location-network-map overflow-hidden rounded-xl border bg-[hsl(var(--background))] px-3 py-5 shadow-sm sm:px-8 sm:py-8"
      style={style}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${block.title || "Location"} dotted network map`}
        className="h-auto w-full"
      >
        <g className="location-network-dots" aria-hidden="true">
          {dots.map((dot, index) => (
            <circle key={`${dot.x}-${dot.y}-${index}`} cx={dot.x} cy={dot.y} r={0.22} />
          ))}
        </g>
        <g className="location-network-arcs" fill="none">
          {connections.map((connection, index) => {
            const path = arcPath(connection.start, connection.end, index);
            return (
              <g key={connection.id}>
                <path className="location-network-arc-base" d={path} pathLength={1} />
                <path
                  className="location-network-arc-flow"
                  d={path}
                  pathLength={1}
                  style={{ "--path-index": index } as CSSProperties}
                />
              </g>
            );
          })}
        </g>
        <g className="location-network-markers">
          {projectedPoints.map((point, index) => {
            const marker = (
              <g>
                <title>{point.name}</title>
                <circle className="location-network-marker-pulse" cx={point.x} cy={point.y} r={1.6} />
                <circle className="location-network-marker" cx={point.x} cy={point.y} r={0.9} />
                {(block.networkShowLabels ?? true) && (
                  <text
                    x={point.x + 1.8}
                    y={point.y - 1.7}
                    className={`location-network-label ${index > 3 ? "location-network-label-extra" : ""}`}
                  >
                    {shorten(point.region || point.name)}
                  </text>
                )}
              </g>
            );
            return point.href ? (
              <a key={point.id} href={point.href} {...linkProps(point.href)}>
                {marker}
              </a>
            ) : (
              <g key={point.id}>{marker}</g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
