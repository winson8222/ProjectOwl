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
