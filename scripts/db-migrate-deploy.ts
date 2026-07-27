/**
 * Deploy-time migration step (Vercel buildCommand).
 *
 *   npm run db:migrate:deploy
 *
 * Same as db:migrate, but SKIPS (exit 0) when no database is configured —
 * a Vercel preview build of a branch without DATABASE_URL/DIRECT_URL env
 * vars must still build. Staging and production have their env vars set,
 * so their builds always migrate before `next build`.
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
  console.log("⏭ No DATABASE_URL/DIRECT_URL configured — skipping migrations.");
  process.exit(0);
}

async function main() {
  const client = postgres(url!, { max: 1 });
  try {
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
