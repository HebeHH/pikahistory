import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * Postgres.js connects to both the automatic local PostgreSQL container and
 * Neon on Vercel, so application code never branches by environment.
 * Connections are lazy and the small pool is reused by a warm Next.js process.
 */
type Database = ReturnType<typeof drizzle>;
type SqlClient = ReturnType<typeof postgres>;

const globalDatabase = globalThis as typeof globalThis & {
  historyWallDatabase?: Database;
  historyWallSqlClient?: SqlClient;
};

export function getDb() {
  if (globalDatabase.historyWallDatabase) {
    return globalDatabase.historyWallDatabase;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const client = postgres(databaseUrl, {
    // Keep each local/Vercel process economical and PgBouncer-compatible.
    max: 1,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  const database = drizzle({ client });

  globalDatabase.historyWallSqlClient = client;
  globalDatabase.historyWallDatabase = database;

  return database;
}
