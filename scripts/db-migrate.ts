/**
 * Apply all pending SQL migrations in drizzle/ to the database.
 *
 *   npm run db:migrate
 *
 * Uses DIRECT_URL when set (unpooled connection — required for DDL against
 * Supabase's transaction-mode pooler), otherwise DATABASE_URL.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { loadEnv } from "./load-env";

loadEnv();

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("❌ Set DATABASE_URL (or DIRECT_URL) in .env.local first.");
  process.exit(1);
}

/**
 * Make `auth.uid()` resolvable on a plain Postgres server.
 *
 * `0004_enable_rls.sql` references auth.uid(), which Supabase provides. A local
 * `createdb projectowl` has no auth schema, so that migration — and every
 * migration after it — failed with `schema "auth" does not exist`. Local dev
 * had been stuck at 0003 as a result.
 *
 * Both statements are strictly additive and no-op on Supabase, where the schema
 * and the real function already exist. The function is only created when
 * absent, never replaced, so Supabase's implementation is never clobbered.
 */
async function ensureAuthShim(client: postgres.Sql) {
  await client.unsafe(`CREATE SCHEMA IF NOT EXISTS auth`);
  await client.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'auth' AND p.proname = 'uid'
      ) THEN
        EXECUTE 'CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS ''SELECT NULL::uuid''';
      END IF;
    END $$;
  `);
}

async function main() {
  const client = postgres(url!, { max: 1 });
  try {
    await ensureAuthShim(client);
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
    console.log("✓ Migrations applied");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
