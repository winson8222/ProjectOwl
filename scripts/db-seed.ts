/**
 * Seed the database with demo users, groups, and transactions.
 *
 *   npm run db:seed
 *
 * Explicit dev/staging step — refuses to run when NODE_ENV=production so a
 * misconfigured environment can't inject demo data into prod. No-ops if the
 * users table already has rows.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/lib/db/schema";
import { seed } from "../src/lib/db/seed";
import { loadEnv } from "./load-env";

loadEnv();

if (process.env.NODE_ENV === "production") {
  console.error("❌ Refusing to seed: NODE_ENV is production.");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ Set DATABASE_URL in .env.local first.");
  process.exit(1);
}

async function main() {
  const client = postgres(url!, { max: 1, prepare: false });
  try {
    const seeded = await seed(drizzle(client, { schema }));
    console.log(seeded ? "✓ Seed data inserted" : "✓ Database already has users — nothing to do");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
