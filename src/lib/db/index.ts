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
  //
  // max is NOT 1.  Fluid compute serves concurrent requests from one instance,
  // so a single connection funnels every in-flight request through one socket:
  // the queue is held client-side (invisible to pg_stat_activity) and the
  // oldest waiters run out the function timeout as a 504.  DATABASE_URL points
  // at the 6543 transaction pooler (see README "Database"), which is built for
  // many short-lived connections, so a small pool per instance is safe here.
  // Do not raise this against DIRECT_URL/5432 — that limit is far lower.
  // The hang this configuration exists to prevent: a socket dies while the
  // instance sits idle (nothing notices — no query is in flight), then the next
  // request writes into it and waits for a reply that never comes.  postgres.js
  // has NO query timeout, so that wait is unbounded; at max:1 one such socket
  // wedged every request on the instance until the platform killed it at 300s.
  //
  // idle_timeout is the main defence: don't hold a socket across an idle gap at
  // all.  5s costs one reconnect (~tens of ms) after a quiet spell and removes
  // almost the whole window in which a stale socket can be reused.
  const client = postgres(url, {
    prepare: false,
    max: 5,
    idle_timeout: 5,
    connect_timeout: 10,
    max_lifetime: 60 * 5, // Recycle sockets so none outlives an idle instance
    keep_alive: 10, // Probe sooner, so a dead peer surfaces as an error
  });
  dbInstance = drizzle(client, { schema });

  return dbInstance;
}

export { schema };
