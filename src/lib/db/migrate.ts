import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

/**
 * Create tables if they don't exist.
 * Uses raw SQL since drizzle-kit isn't running at runtime.
 * Compatible with PostgreSQL syntax for future migration.
 */
export function migrate(db: BetterSQLite3Database<typeof schema>) {
  // We use db.run() with SQL since drizzle-kit migrations aren't
  // wired at runtime. This keeps it self-contained.
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      avatar_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS friendships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      total_amount REAL NOT NULL,
      paid_by_user_id TEXT NOT NULL REFERENCES users(id),
      transaction_date TEXT NOT NULL,
      notes TEXT,
      receipt_image TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quantity INTEGER DEFAULT 1 NOT NULL,
      price REAL NOT NULL,
      category TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS item_assignments (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES transaction_items(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      share_amount REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL REFERENCES users(id),
      to_user_id TEXT NOT NULL REFERENCES users(id),
      transaction_id TEXT REFERENCES transactions(id),
      amount REAL NOT NULL,
      settled_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_paid_by ON transactions(paid_by_user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_items_transaction ON transaction_items(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_item ON item_assignments(item_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_user ON item_assignments(user_id);
    CREATE INDEX IF NOT EXISTS idx_settlements_from ON settlements(from_user_id);
    CREATE INDEX IF NOT EXISTS idx_settlements_to ON settlements(to_user_id);
  `;

  // Split by semicolons and run each statement separately
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    db.run(stmt + ";");
  }
}
