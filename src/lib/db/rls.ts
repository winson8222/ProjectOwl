/**
 * Row Level Security — per-request auth context.
 *
 * The RLS policies in drizzle/0004_enable_rls.sql use auth.uid() to scope
 * data access.  On a direct Postgres connection auth.uid() returns null
 * (the postgres role bypasses RLS entirely), so we explicitly set the JWT
 * claims and role at the start of every API request.
 *
 * Usage — call once at the top of every authenticated route handler:
 *
 *   import { setRequestAuth } from "@/lib/db/rls";
 *   await setRequestAuth(me.authId);  // me.authId = auth.users.id UUID
 *
 * After this call all subsequent queries on the shared connection see the
 * correct auth.uid() and RLS policies apply.
 *
 * Important: the singleton connection pool uses max:1 (see db/index.ts).
 * With a single connection queries are strictly serialised, so there is no
 * risk of auth-context leakage between concurrent requests.
 */

import { sql } from "drizzle-orm";
import { getDb } from "./index";

/**
 * Set the Postgres session variables that Supabase RLS policies read.
 * Must be called before any data-access queries in the current request.
 *
 * @param authId — the Supabase auth.users.id UUID (from the verified session)
 */
export async function setRequestAuth(authId: string): Promise<void> {
  const db = getDb();

  // auth.uid() reads current_setting('request.jwt.claims')::json->>'sub'
  await db.execute(
    sql`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: authId })}, true)`
  );

  // Switch to the authenticated role so RLS policies apply.
  // (postgres / service_role bypass RLS automatically.)
  await db.execute(sql`SELECT set_config('role', 'authenticated', true)`);
}

/**
 * Clear the auth context — useful in middleware error paths or when a
 * route handler wants to ensure no context leaks to the next request.
 */
export async function clearRequestAuth(): Promise<void> {
  const db = getDb();
  await db.execute(sql`RESET role`);
  await db.execute(sql`RESET request.jwt.claims`);
}
