import { defineConfig } from "drizzle-kit";

// Drizzle is the source of truth for application tables.
// Better Auth manages its own auth tables (added in Phase 2).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://photog:photog@localhost:5432/photography",
  },
  strict: true,
  verbose: true,
});
