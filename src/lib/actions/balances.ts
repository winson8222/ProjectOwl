import { getDb, schema, type Db } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { getGroupMemberIds } from "./groups";
import { pairwiseFor } from "@/lib/simplify";

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
export async function getBalance(
  userId: string,
  _db?: Db,
  groupId?: string
): Promise<BalanceSummary> {
  const db = _db ?? getDb();

  // Pairwise net vs. every counterparty: positive = they owe the user.
  const net = new Map<string, number>();
  const bump = (otherId: string, delta: number) =>
    net.set(otherId, (net.get(otherId) ?? 0) + delta);

  // ── Transactions ───────────────────────────────────────────────────
  const txs = await db
    .select({ id: schema.transactions.id, paidBy: schema.transactions.paidByUserId })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.isDeleted, false),
        groupId ? eq(schema.transactions.groupId, groupId) : undefined
      )
    );

  // Participants and payers for all transactions in two IN queries — this scan
  // is unscoped (every group) for the overall balance, so a per-transaction
  // loop here was the single most expensive path in the app.
  if (txs.length > 0) {
    const txIds = txs.map((t) => t.id);
    const [parts, payerRows] = await Promise.all([
      db
        .select({
          transactionId: schema.participants.transactionId,
          userId: schema.participants.userId,
          shareAmount: schema.participants.shareAmount,
        })
        .from(schema.participants)
        .where(inArray(schema.participants.transactionId, txIds)),
      db
        .select({
          transactionId: schema.transactionPayers.transactionId,
          userId: schema.transactionPayers.userId,
          amountPaid: schema.transactionPayers.amountPaid,
        })
        .from(schema.transactionPayers)
        .where(inArray(schema.transactionPayers.transactionId, txIds)),
    ]);

    const payersByTx = new Map<string, { userId: string; amountPaid: number }[]>();
    for (const row of payerRows) {
      const list = payersByTx.get(row.transactionId) ?? [];
      list.push({ userId: row.userId, amountPaid: row.amountPaid });
      payersByTx.set(row.transactionId, list);
    }

    const partsByTx = new Map<string, { userId: string; shareAmount: number }[]>();
    for (const p of parts) {
      const list = partsByTx.get(p.transactionId) ?? [];
      list.push({ userId: p.userId, shareAmount: p.shareAmount });
      partsByTx.set(p.transactionId, list);
    }

    // Attribution lives in simplify.ts so this and getGroupPage can't drift —
    // they were separate copies, and only one of them ever learned about
    // multiple payers.
    const simple = txs.map((tx) => ({
      paidBy: tx.paidBy,
      payers: payersByTx.get(tx.id),
      participants: partsByTx.get(tx.id) ?? [],
    }));

    for (const [otherId, amount] of pairwiseFor(simple, userId)) {
      bump(otherId, amount);
    }
  }

  // ── Paid settlements ───────────────────────────────────────────────
  const settlements = await db
    .select()
    .from(schema.settlements)
    .where(
      and(
        eq(schema.settlements.settledAt, "PAID"),
        groupId ? eq(schema.settlements.groupId, groupId) : undefined
      )
    );

  for (const s of settlements) {
    if (s.toUserId === userId) {
      bump(s.fromUserId, -s.amount); // they already paid the user back
    } else if (s.fromUserId === userId) {
      bump(s.toUserId, s.amount); // the user already paid them back
    }
  }

  // ── Resolve counterparties (group scope: include settled members too) ──
  if (groupId) {
    for (const memberId of await getGroupMemberIds(groupId)) {
      if (memberId !== userId && !net.has(memberId)) net.set(memberId, 0);
    }
  }

  const counterpartyIds = [...net.keys()];
  const counterparties = counterpartyIds.length > 0
    ? await db.select().from(schema.users).where(inArray(schema.users.id, counterpartyIds))
    : [];
  const usersById = new Map(counterparties.map((u) => [u.id, u]));

  const perPerson: BalanceSummary["perPerson"] = [];
  for (const [otherId, amount] of net.entries()) {
    const user = usersById.get(otherId);
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
