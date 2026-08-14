/**
 * Test runner for the settlement-balance logic.
 *
 * Each fixture sets up an in-memory PGlite (Postgres-in-WASM) database with
 * users, transactions, and settlements, then calls `getBalance()` to verify
 * the per-person balances match expectations. No server or external database
 * needed — used by both the CLI (`npm run test:settlement`) and the debug
 * API endpoint.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import * as schema from "../db/schema";
import { getBalance } from "../actions/balances";
import { SETTLEMENT_FIXTURES, type SettlementFixture } from "./settlement-fixtures";

export interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface CaseResult {
  name: string;
  description: string;
  balances: { friendId: string; actual: number; expected: number }[];
  checks: CheckResult[];
  passed: boolean;
}

export interface SuiteResult {
  total: number;
  passed: number;
  failed: number;
  cases: CaseResult[];
}

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Stand in for the parts of Supabase this schema depends on.
 *
 * 0004_enable_rls.sql writes its policies against `auth.uid()`, which only
 * exists on Supabase. PGlite is plain Postgres, so migrating into it died on
 * `schema "auth" does not exist` and took the whole suite down with it.
 *
 * Defining the same function up front lets every real migration apply
 * unchanged, so the suite keeps exercising the schema production actually
 * has — RLS policies included — rather than whichever subset happens to be
 * portable. The body matches Supabase's own definition; it returns NULL here
 * because nothing sets a JWT claim, which is fine: PGlite connects as the
 * table owner, and owners bypass RLS unless FORCE ROW LEVEL SECURITY is set.
 *
 * Test-harness only. Nothing in drizzle/ is touched, so this can't affect a
 * real migration against Supabase or a local Postgres.
 */
async function stubSupabaseAuth(client: PGlite) {
  await client.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE
      AS $$
        SELECT nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
      $$;
  `);
}

/**
 * Apply every migration in journal order, the way psql would.
 *
 * Not drizzle's migrator: that splits a file on `--> statement-breakpoint`
 * markers and sends each piece as a prepared statement. 0004_enable_rls.sql
 * is hand-written and has no such markers, so the whole file arrived as one
 * statement and PGlite refused it ("cannot insert multiple commands into a
 * prepared statement"). `exec` runs a multi-statement script directly, which
 * is what that file is.
 *
 * Reading the journal rather than globbing keeps the order authoritative and
 * skips any .sql file that isn't actually a registered migration.
 */
async function applyMigrations(client: PGlite) {
  const dir = path.join(process.cwd(), "drizzle");
  const journal = JSON.parse(
    await fs.readFile(path.join(dir, "meta", "_journal.json"), "utf8")
  ) as { entries: { idx: number; tag: string }[] };

  for (const entry of [...journal.entries].sort((a, b) => a.idx - b.idx)) {
    await client.exec(await fs.readFile(path.join(dir, `${entry.tag}.sql`), "utf8"));
  }
}

/** Create a fresh in-memory database and apply the real migrations. */
async function createTestDb() {
  const client = new PGlite(); // in-memory, nothing touches disk
  await stubSupabaseAuth(client);
  await applyMigrations(client);
  const db = drizzle(client, { schema });
  return { client, db };
}

/** Wipe all tables between fixtures (one shared instance keeps the suite fast). */
async function truncateAll(db: TestDb) {
  await db.execute(sql`
    TRUNCATE TABLE
      activities, item_assignments, participants, transaction_payers,
      transaction_items,
      transactions, settlements, group_members, groups, friendships, users
    CASCADE
  `);
}

/** Load a fixture into the DB. */
async function loadFixture(fixture: SettlementFixture, db: TestDb) {
  const { users, friendships, transactions, settlements } = fixture;

  // Insert users
  for (const u of users) {
    await db.insert(schema.users).values({ ...u, avatarUrl: null });
  }

  // Insert friendships (two-way)
  for (const [a, b] of friendships) {
    await db.insert(schema.friendships).values({ id: `f-${a}-${b}`, userId: a, friendId: b });
    await db.insert(schema.friendships).values({ id: `f-${b}-${a}`, userId: b, friendId: a });
  }

  // Insert transactions + participants
  for (const tx of transactions) {
    await db.insert(schema.transactions).values({
      id: tx.id,
      title: tx.title,
      totalAmount: tx.totalAmount,
      paidByUserId: tx.paidByUserId,
      transactionDate: tx.transactionDate,
      isDeleted: false,
    });

    for (const p of tx.participants) {
      await db.insert(schema.participants).values({
        id: `p-${tx.id}-${p.userId}`,
        transactionId: tx.id,
        userId: p.userId,
        shareAmount: p.shareAmount,
      });
    }

    // Payer rows. A fixture without `payers` gets a single full-amount row,
    // matching what createTransaction writes and what migration 0005
    // backfilled for every pre-multi-payer transaction.
    const payers = tx.payers ?? [
      { userId: tx.paidByUserId, amountPaid: tx.totalAmount },
    ];
    for (const q of payers) {
      await db.insert(schema.transactionPayers).values({
        id: `tp-${tx.id}-${q.userId}`,
        transactionId: tx.id,
        userId: q.userId,
        amountPaid: q.amountPaid,
      });
    }
  }

  // Insert settlements
  for (const s of settlements) {
    await db.insert(schema.settlements).values({
      id: s.id,
      fromUserId: s.fromUserId,
      toUserId: s.toUserId,
      amount: s.amount,
      transactionId: null,
      settledAt: s.settledAt,
    });
  }
}

async function runCase(fixture: SettlementFixture, db: TestDb): Promise<CaseResult> {
  await truncateAll(db);
  await loadFixture(fixture, db);

  const viewerId = fixture.users[0].id;
  const balance = await getBalance(viewerId, db as never);

  const checks: CheckResult[] = [];
  const balanceResults: { friendId: string; actual: number; expected: number }[] = [];

  // Check every expected balance
  let allMatch = true;
  for (const [friendId, expected] of Object.entries(fixture.expectedBalances)) {
    const perPerson = balance.perPerson.find((p) => p.user.id === friendId);
    const actual = perPerson?.amount ?? 0;
    const diff = Math.abs(actual - expected);
    balanceResults.push({ friendId, actual, expected });

    if (diff > 0.01) {
      allMatch = false;
      checks.push({
        name: `${friendId} balance`,
        passed: false,
        detail: `expected ${expected.toFixed(2)}, got ${actual.toFixed(2)} (diff ${diff.toFixed(2)})`,
      });
    }
  }

  if (allMatch) {
    checks.push({ name: "all balances match", passed: true });
  }

  // Verify totalOwed / totalOwe consistency
  const positiveSum = balanceResults
    .filter((r) => r.actual > 0)
    .reduce((s, r) => s + r.actual, 0);
  const negativeSum = balanceResults
    .filter((r) => r.actual < 0)
    .reduce((s, r) => s + Math.abs(r.actual), 0);

  if (Math.abs(balance.totalOwed - positiveSum) > 0.01) {
    checks.push({
      name: "totalOwed matches perPerson sum",
      passed: false,
      detail: `totalOwed=${balance.totalOwed.toFixed(2)} but sum of positive balances=${positiveSum.toFixed(2)}`,
    });
  }
  if (Math.abs(balance.totalOwe - negativeSum) > 0.01) {
    checks.push({
      name: "totalOwe matches perPerson sum",
      passed: false,
      detail: `totalOwe=${balance.totalOwe.toFixed(2)} but sum of negative balances=${negativeSum.toFixed(2)}`,
    });
  }

  // Verify netBalance = totalOwed - totalOwe
  const expectedNet = positiveSum - negativeSum;
  if (Math.abs(balance.netBalance - expectedNet) > 0.01) {
    checks.push({
      name: "netBalance = totalOwed - totalOwe",
      passed: false,
      detail: `netBalance=${balance.netBalance.toFixed(2)} but ${positiveSum.toFixed(2)} - ${negativeSum.toFixed(2)} = ${expectedNet.toFixed(2)}`,
    });
  }

  return {
    name: fixture.name,
    description: fixture.description,
    balances: balanceResults,
    checks,
    passed: checks.length === 0 || checks.every((c) => c.passed),
  };
}

/** Run all fixtures and return a structured result. */
export async function runSettlementTests(): Promise<SuiteResult> {
  const { client, db } = await createTestDb();
  try {
    const cases: CaseResult[] = [];
    for (const fixture of SETTLEMENT_FIXTURES) {
      cases.push(await runCase(fixture, db));
    }
    const passed = cases.filter((c) => c.passed).length;
    return {
      total: cases.length,
      passed,
      failed: cases.length - passed,
      cases,
    };
  } finally {
    await client.close();
  }
}
