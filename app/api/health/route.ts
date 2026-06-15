import { NextResponse } from "next/server";

// Liveness endpoint used by the compose healthcheck for the `web` service.
// Kept dependency-free in Phase 1 so it cannot fail on cold start. Phase 6
// adds an optional deep `/api/health?deep=1` that pings db/redis/storage.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "web",
    time: new Date().toISOString(),
  });
}
