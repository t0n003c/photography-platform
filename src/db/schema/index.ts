// Drizzle schema — single source of truth for all tables.
// Auth tables are Better Auth–owned (shape only); app tables are ours.
export * from "./auth";
export * from "./app";
