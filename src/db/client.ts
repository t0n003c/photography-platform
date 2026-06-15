import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/src/lib/env";
import * as schema from "@/src/db/schema";

// Single shared connection pool. Schema tables land in src/db/schema (Phase 2).
let client: ReturnType<typeof postgres> | null = null;

function getClient() {
  if (!client) {
    client = postgres(getEnv().DATABASE_URL, { max: 10 });
  }
  return client;
}

export const db = drizzle(getClient(), { schema });
export type DB = typeof db;
