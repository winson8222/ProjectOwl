import { defineConfig } from "drizzle-kit";

// DIRECT_URL (unpooled, port 5432) is preferred for DDL; falls back to
// DATABASE_URL for simple local setups where they're the same server.
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
