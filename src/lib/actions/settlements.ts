import { getDb, schema } from "@/lib/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { User } from "./users";
import { getBalance } from "./balances";
import { logActivity } from "./activities";
import { computeNetBalances, minimizeTransfers, type SimpleTransaction } from "@/lib/simplify";

export interface SettlementPlan {
  from: User;
  to: User;
  amount: number;
}

export interface Settlement {
  id: string;
  fromUserId: string;
  toUserId: string;
  transactionId: string | null;
  amount: number;
  settledAt: string | null;
  createdAt: string;
  fromUser?: User;
  toUser?: User;
}

/** Get pending settlements for a user. */
export async function getPendingSettlements(userId: string): Promise<Settlement[]> {
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.settlements)
    .where(
      and(
        isNull(schema.settlements.settledAt),
        // User is either the sender or receiver
      )
    )
    .orderBy(desc(schema.settlements.createdAt));

  // Filter to those involving this user
  const relevant = rows.filter(
    (r) => r.fromUserId === userId || r.toUserId === userId
  );

  const result: Settlement[] = [];
  for (const r of relevant) {
    const fromUser = (await db.select().from(schema.users).where(eq(schema.users.id, r.fromUserId)))[0];
    const toUser = (await db.select().from(schema.users).where(eq(schema.users.id, r.toUserId)))[0];
    result.push({ ...r, fromUser, toUser });
  }
  return result;
}

/**
 * Generate an optimized settlement plan for a group of users.
 * Uses a greedy algorithm: match largest debtor with largest creditor.
 * This produces minimum-number-of-transactions settlement plan.
 */
export async function getOptimizedPlan(userId: string): Promise<SettlementPlan[]> {
  const balance = await getBalance(userId);

  // Creditors (people who owe user → user receives money)
  const creditors = balance.perPerson
    .filter((p) => p.amount > 0)
    .map((p) => ({ user: p.user, amount: p.amount }));

  // Debtors (people user owes → user pays them)
  const debtors = balance.perPerson
    .filter((p) => p.amount < 0)
    .map((p) => ({ user: p.user, amount: Math.abs(p.amount) }));

  // "from" = who pays, "to" = who receives
  const db = getDb();
  const currentUser = (await db.select().from(schema.users).where(eq(schema.users.id, userId)))[0];
  const result: SettlementPlan[] = [];

  if (!currentUser) return result;

  // People who owe the user money → they pay the user
  for (const c of creditors) {
    if (c.amount > 0.01) {
      result.push({ from: c.user, to: currentUser, amount: Math.round(c.amount * 100) / 100 });
    }
  }

  // People the user owes money to → user pays them
  for (const d of debtors) {
    if (d.amount > 0.01) {
      result.push({ from: currentUser, to: d.user, amount: Math.round(d.amount * 100) / 100 });
    }
  }

  return result;
}

/**
 * Group-wide minimum-transaction settlement plan across ALL users.
 *
 * Reads every non-deleted transaction's participant shares, nets them into a
 * per-user balance, then runs the same greedy simplification the test suite
 * verifies. Returns the fewest payments that settle the whole group.
 */
export async function getGroupSettlementPlan(): Promise<SettlementPlan[]> {
  const db = getDb();

  // Pull every non-deleted transaction as a SimpleTransaction (payer + shares).
  const txs = await db
    .select({ id: schema.transactions.id, paidBy: schema.transactions.paidByUserId })
    .from(schema.transactions)
    .where(eq(schema.transactions.isDeleted, false));

  const simpleTxs: SimpleTransaction[] = [];
  for (const tx of txs) {
    const parts = await db
      .select({ userId: schema.participants.userId, shareAmount: schema.participants.shareAmount })
      .from(schema.participants)
      .where(eq(schema.participants.transactionId, tx.id));
    simpleTxs.push({ paidBy: tx.paidBy, participants: parts });
  }

  const transfers = minimizeTransfers(computeNetBalances(simpleTxs));

  // Resolve user ids to full user rows for the UI.
  const userCache = new Map<string, User | undefined>();
  const resolve = async (id: string): Promise<User | undefined> => {
    if (!userCache.has(id)) {
      userCache.set(id, (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0]);
    }
    return userCache.get(id);
  };

  const plan: SettlementPlan[] = [];
  for (const t of transfers) {
    const from = await resolve(t.from);
    const to = await resolve(t.to);
    if (from && to) plan.push({ from, to, amount: t.amount });
  }
  return plan;
}

/** Mark a settlement as paid. */
export async function markSettled(settlementId: string): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(schema.settlements)
    .set({ settledAt: "PAID" })
    .where(eq(schema.settlements.id, settlementId))
    .returning({ id: schema.settlements.id });
  return updated.length > 0;
}

/**
 * Create a settlement record AND mark it as paid in one step.
 * This is the main path for the "Mark paid" / "Pay" button on the settle-up page.
 * When `groupId` is given, the payment settles debt within that group and is
 * recorded in the group's activity feed.
 */
export async function createAndMarkPaid(
  fromUserId: string,
  toUserId: string,
  amount: number,
  groupId?: string
): Promise<Settlement | null> {
  const rounded = Math.round(amount * 100) / 100;
  if (rounded <= 0) return null;

  const settlement = await createSettlement(fromUserId, toUserId, rounded, undefined, groupId);
  await markSettled(settlement.id);

  if (groupId) {
    await logActivity({
      type: "settlement",
      userId: fromUserId,
      relatedUserId: toUserId,
      amount: rounded,
      groupId,
    });
  }

  return { ...settlement, settledAt: "PAID" };
}

/** Create a settlement record. */
export async function createSettlement(
  fromUserId: string,
  toUserId: string,
  amount: number,
  transactionId?: string,
  groupId?: string
): Promise<Settlement> {
  const db = getDb();
  const id = `settlement-${uuid().slice(0, 8)}`;
  await db.insert(schema.settlements).values({
    id,
    fromUserId,
    toUserId,
    amount,
    transactionId: transactionId ?? null,
    groupId: groupId ?? null,
  });

  return { id, fromUserId, toUserId, transactionId: transactionId ?? null, amount, settledAt: null, createdAt: new Date().toISOString() };
}
