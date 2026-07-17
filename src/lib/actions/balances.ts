import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getGroupMemberIds } from "./groups";

export interface BalanceSummary {
  netBalance: number;
  totalOwed: number; // total others owe you
  totalOwe: number; // total you owe others
  topDebtor: { user: typeof schema.users.$inferSelect; amount: number } | null;
  topCreditor: { user: typeof schema.users.$inferSelect; amount: number } | null;
  perPerson: { user: typeof schema.users.$inferSelect; amount: number }[]; // positive = they owe you
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Compute the full balance summary for a user.
 * Balances are computed from raw data (not stored) to stay consistent.
 *
 * Derived from transactions + paid settlements directly (not friendships),
 * so it works across group memberships. Pass `groupId` to scope the whole
 * summary to one group's transactions, settlements, and members.
 *
 * @param userId The user to compute balances for.
 * @param _db Optional database instance (for testing with in-memory DBs).
 * @param groupId Optional group to scope the summary to.
 */
export function getBalance(
  userId: string,
  _db?: ReturnType<typeof getDb>,
  groupId?: string
): BalanceSummary {
  const db = _db ?? getDb();

  // Pairwise net vs. every counterparty: positive = they owe the user.
  const net = new Map<string, number>();
  const bump = (otherId: string, delta: number) =>
    net.set(otherId, (net.get(otherId) ?? 0) + delta);

  // ── Transactions ───────────────────────────────────────────────────
  const txs = db
    .select({ id: schema.transactions.id, paidBy: schema.transactions.paidByUserId })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.isDeleted, false),
        groupId ? eq(schema.transactions.groupId, groupId) : undefined
      )
    )
    .all();

  for (const tx of txs) {
    const parts = db
      .select({ userId: schema.participants.userId, shareAmount: schema.participants.shareAmount })
      .from(schema.participants)
      .where(eq(schema.participants.transactionId, tx.id))
      .all();

    for (const p of parts) {
      if (p.userId === tx.paidBy) continue; // can't owe yourself
      if (tx.paidBy === userId && p.userId !== userId) {
        bump(p.userId, p.shareAmount); // they owe the user
      } else if (p.userId === userId) {
        bump(tx.paidBy, -p.shareAmount); // the user owes the payer
      }
    }
  }

  // ── Paid settlements ───────────────────────────────────────────────
  const settlements = db
    .select()
    .from(schema.settlements)
    .where(
      and(
        eq(schema.settlements.settledAt, "PAID"),
        groupId ? eq(schema.settlements.groupId, groupId) : undefined
      )
    )
    .all();

  for (const s of settlements) {
    if (s.toUserId === userId) {
      bump(s.fromUserId, -s.amount); // they already paid the user back
    } else if (s.fromUserId === userId) {
      bump(s.toUserId, s.amount); // the user already paid them back
    }
  }

  // ── Resolve counterparties (group scope: include settled members too) ──
  if (groupId) {
    for (const memberId of getGroupMemberIds(groupId)) {
      if (memberId !== userId && !net.has(memberId)) net.set(memberId, 0);
    }
  }

  const perPerson: BalanceSummary["perPerson"] = [];
  for (const [otherId, amount] of net.entries()) {
    const user = db.select().from(schema.users).where(eq(schema.users.id, otherId)).get();
    if (!user) continue;
    perPerson.push({ user, amount: round2(amount) });
  }
  perPerson.sort((a, b) => b.amount - a.amount);

  const totalOwed = round2(perPerson.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0));
  const totalOwe = round2(perPerson.filter((p) => p.amount < 0).reduce((s, p) => s + Math.abs(p.amount), 0));
  const netBalance = round2(totalOwed - totalOwe);

  // Top debtor (owes user the most = highest positive amount)
  const positive = perPerson.filter((p) => p.amount > 0);
  const topDebtor = positive.length > 0 ? positive[0] : null;

  // Top creditor (user owes the most = most negative)
  const negative = perPerson.filter((p) => p.amount < 0).sort((a, b) => a.amount - b.amount);
  const topCreditor = negative.length > 0 ? negative[0] : null;

  return { netBalance, totalOwed, totalOwe, topDebtor, topCreditor, perPerson };
}
