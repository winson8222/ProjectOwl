import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let dbInstance: Db | null = null;

/**
 * Get or initialize the database client.
 *
 * Connection-only: schema migrations run at deploy time (`npm run db:migrate`)
 * and seeding is an explicit dev/staging step (`npm run db:seed`) — neither
 * belongs in the request path.
 */
export function getDb(): Db {
  if (dbInstance) return dbInstance;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local, e.g. postgresql://postgres:postgres@localhost:5432/projectowl"
    );
  }

  // prepare:false keeps the client compatible with transaction-mode poolers
  // (Supabase pgbouncer on port 6543); harmless against a direct connection.
  const client = postgres(url, { prepare: false });
  dbInstance = drizzle(client, { schema });

  return dbInstance;
}

export { schema };
