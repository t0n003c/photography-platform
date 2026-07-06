import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/src/db/client";
import { getRedis } from "@/src/redis/client";

// Liveness endpoint used by the compose healthcheck for the `web` service.
// The default response stays dependency-free so container liveness is not tied
// to transient backing-service checks. Use `/api/health?deep=1` for operator
// readiness checks that include the DB and Redis.
export const dynamic = "force-dynamic";

type CheckStatus = {
  status: "ok" | "degraded";
  latencyMs: number;
  message?: string;
};

async function timedCheck(fn: () => Promise<unknown>): Promise<CheckStatus> {
  const started = performance.now();
  try {
    await fn();
    return {
      status: "ok",
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
    };
  } catch (err) {
    return {
      status: "degraded",
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
      message: err instanceof Error ? err.message : "Unknown health check failure",
    };
  }
}

export async function GET(req: NextRequest) {
  const base = {
    status: "ok",
    service: "web",
    time: new Date().toISOString(),
  };

  if (req.nextUrl.searchParams.get("deep") !== "1") {
    return NextResponse.json(base);
  }

  const [dbCheck, redisCheck] = await Promise.all([
    timedCheck(() => db.execute(sql`select 1`)),
    timedCheck(() => getRedis().ping()),
  ]);
  const status =
    dbCheck.status === "ok" && redisCheck.status === "ok" ? "ok" : "degraded";

  return NextResponse.json(
    {
      ...base,
      status,
      checks: {
        db: dbCheck,
        redis: redisCheck,
      },
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
