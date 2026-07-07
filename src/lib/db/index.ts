import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { migrate } from "./migrate";
import { seed } from "./seed";
import path from "path";

const DB_PATH = process.env.DATABASE_URL
  ? path.resolve(process.env.DATABASE_URL)
  : path.resolve(process.cwd(), "data/projectowl.db");

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Get or initialize the database client.
 * Ensures tables exist and seed data is populated on first run.
 */
export function getDb() {
  if (dbInstance) return dbInstance;

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL"); // better concurrent access
  sqlite.pragma("foreign_keys = ON");

  dbInstance = drizzle(sqlite, { schema });

  // Auto-migrate + seed on first load
  migrate(dbInstance);
  seed(dbInstance);

  return dbInstance;
}

export { schema };
