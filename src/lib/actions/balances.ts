import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export interface BalanceSummary {
  netBalance: number;
  totalOwed: number; // total others owe you
  totalOwe: number; // total you owe others
  topDebtor: { user: typeof schema.users.$inferSelect; amount: number } | null;
  topCreditor: { user: typeof schema.users.$inferSelect; amount: number } | null;
  perPerson: { user: typeof schema.users.$inferSelect; amount: number }[]; // positive = they owe you
}

/**
 * Compute the full balance summary for a user.
 * Balances are computed from raw data (not stored) to stay consistent.
 *
 * @param userId The user to compute balances for.
 * @param _db Optional database instance (for testing with in-memory DBs).
 */
export function getBalance(userId: string, _db?: ReturnType<typeof getDb>): BalanceSummary {
  const db = _db ?? getDb();

  // Get all friends
  const friendRows = db
    .select({ friendId: schema.friendships.friendId })
    .from(schema.friendships)
    .where(eq(schema.friendships.userId, userId))
    .all();

  const perPerson: BalanceSummary["perPerson"] = [];

  for (const { friendId } of friendRows) {
    const friend = db.select().from(schema.users).where(eq(schema.users.id, friendId)).get();
    if (!friend) continue;

    // Friend's share in transactions paid by user (friend owes user)
    const friendOwesUser = db
      .select({ sum: schema.participants.shareAmount })
      .from(schema.participants)
      .innerJoin(
        schema.transactions,
        eq(schema.participants.transactionId, schema.transactions.id)
      )
      .where(
        and(
          eq(schema.transactions.paidByUserId, userId),
          eq(schema.participants.userId, friendId),
          eq(schema.transactions.isDeleted, false)
        )
      )
      .all()
      .reduce((sum, r) => sum + r.sum, 0);

    // User's share in transactions paid by friend (user owes friend)
    const userOwesFriend = db
      .select({ sum: schema.participants.shareAmount })
      .from(schema.participants)
      .innerJoin(
        schema.transactions,
        eq(schema.participants.transactionId, schema.transactions.id)
      )
      .where(
        and(
          eq(schema.transactions.paidByUserId, friendId),
          eq(schema.participants.userId, userId),
          eq(schema.transactions.isDeleted, false)
        )
      )
      .all()
      .reduce((sum, r) => sum + r.sum, 0);

    // Settlements: friend already paid user
    const friendPaidUser = db
      .select({ sum: schema.settlements.amount })
      .from(schema.settlements)
      .where(
        and(
          eq(schema.settlements.fromUserId, friendId),
          eq(schema.settlements.toUserId, userId),
          eq(schema.settlements.settledAt, "PAID")
        )
      )
      .all()
      .reduce((sum, r) => sum + r.sum, 0);

    // Settlements: user already paid friend
    const userPaidFriend = db
      .select({ sum: schema.settlements.amount })
      .from(schema.settlements)
      .where(
        and(
          eq(schema.settlements.fromUserId, userId),
          eq(schema.settlements.toUserId, friendId),
          eq(schema.settlements.settledAt, "PAID")
        )
      )
      .all()
      .reduce((sum, r) => sum + r.sum, 0);

    // Net: positive = friend owes user
    const net = friendOwesUser - userOwesFriend - friendPaidUser + userPaidFriend;
    perPerson.push({ user: friend, amount: net });
  }

  const totalOwed = perPerson.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0);
  const totalOwe = perPerson.filter((p) => p.amount < 0).reduce((s, p) => s + Math.abs(p.amount), 0);
  const netBalance = totalOwed - totalOwe;

  // Top debtor (owes user the most = highest positive amount)
  const positive = perPerson.filter((p) => p.amount > 0).sort((a, b) => b.amount - a.amount);
  const topDebtor = positive.length > 0 ? positive[0] : null;

  // Top creditor (user owes the most = most negative)
  const negative = perPerson.filter((p) => p.amount < 0).sort((a, b) => a.amount - b.amount);
  const topCreditor = negative.length > 0 ? negative[0] : null;

  return { netBalance, totalOwed, totalOwe, topDebtor, topCreditor, perPerson };
}
