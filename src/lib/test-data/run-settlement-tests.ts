/**
 * Test runner for the settlement-balance logic.
 *
 * Each fixture sets up an in-memory PGlite (Postgres-in-WASM) database with
 * users, transactions, and settlements, then calls `getBalance()` to verify
 * the per-person balances match expectations. No server or external database
 * needed — used by both the CLI (`npm run test:settlement`) and the debug
 * API endpoint.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
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

/** Create a fresh in-memory database and apply the real migrations. */
async function createTestDb() {
  const client = new PGlite(); // in-memory, nothing touches disk
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { client, db };
}

/** Wipe all tables between fixtures (one shared instance keeps the suite fast). */
async function truncateAll(db: TestDb) {
  await db.execute(sql`
    TRUNCATE TABLE
      activities, item_assignments, participants, transaction_items,
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
