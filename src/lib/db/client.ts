import "server-only";

import { drizzle } from "drizzle-orm/neon-http";

/**
 * Lazily create the Neon HTTP client on the first API request. Keeping this
 * lazy allows TypeScript checks and Next.js builds to run before a developer
 * has configured DATABASE_URL locally.
 */
let database: ReturnType<typeof drizzle> | undefined;

export function getDb() {
  if (database) {
    return database;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  database = drizzle(databaseUrl);
  return database;
}
