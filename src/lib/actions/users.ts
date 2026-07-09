import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export type User = typeof schema.users.$inferSelect;
export type NewUser = typeof schema.users.$inferInsert;
export type FriendWithBalance = User & { balance: number };

/** Get all users. */
export function getUsers(): User[] {
  return getDb().select().from(schema.users).all();
}

/** Get a single user by ID. */
export function getUser(id: string): User | undefined {
  return getDb().select().from(schema.users).where(eq(schema.users.id, id)).get();
}

/** Create a new user. */
export function createUser(name: string, email: string): User {
  const id = `user-${uuid().slice(0, 8)}`;
  getDb().insert(schema.users).values({ id, name, email }).run();
  return { id, name, email, avatarUrl: null, createdAt: new Date().toISOString() };
}

/** Get all friends for a user (with net balance). */
export function getFriends(userId: string): FriendWithBalance[] {
  const db = getDb();

  // Get friend IDs
  const rows = db
    .select({ friendId: schema.friendships.friendId })
    .from(schema.friendships)
    .where(eq(schema.friendships.userId, userId))
    .all();

  if (rows.length === 0) return [];

  const friendIds = rows.map((r) => r.friendId);
  const friends = db
    .select()
    .from(schema.users)
    .where(
      // SQLite doesn't support array contains, use OR chain
      and(...friendIds.map((id) => eq(schema.users.id, id)))
    )
    .all();

  // For each friend, compute net balance
  return friends.map((f) => ({
    ...f,
    balance: computeBalanceWithUser(userId, f.id),
  }));
}

/** Compute net balance between two users (positive = friend owes user). */
function computeBalanceWithUser(userId: string, friendId: string): number {
  const db = getDb();

  // Get all items where this friend was assigned, paid by userId
  const paidByUser = db
    .select({
      shareAmount: schema.itemAssignments.shareAmount,
    })
    .from(schema.itemAssignments)
    .innerJoin(
      schema.transactionItems,
      eq(schema.itemAssignments.itemId, schema.transactionItems.id)
    )
    .innerJoin(
      schema.transactions,
      eq(schema.transactionItems.transactionId, schema.transactions.id)
    )
    .where(
      and(
        eq(schema.transactions.paidByUserId, userId),
        eq(schema.itemAssignments.userId, friendId),
        eq(schema.transactions.isDeleted, false)
      )
    )
    .all();

  // Get all items where user was assigned, paid by friend
  const paidByFriend = db
    .select({
      shareAmount: schema.itemAssignments.shareAmount,
    })
    .from(schema.itemAssignments)
    .innerJoin(
      schema.transactionItems,
      eq(schema.itemAssignments.itemId, schema.transactionItems.id)
    )
    .innerJoin(
      schema.transactions,
      eq(schema.transactionItems.transactionId, schema.transactions.id)
    )
    .where(
      and(
        eq(schema.transactions.paidByUserId, friendId),
        eq(schema.itemAssignments.userId, userId),
        eq(schema.transactions.isDeleted, false)
      )
    )
    .all();

  // Settlements: friend paid user
  const settlementsToUser = db
    .select({ amount: schema.settlements.amount })
    .from(schema.settlements)
    .where(
      and(
        eq(schema.settlements.fromUserId, friendId),
        eq(schema.settlements.toUserId, userId),
        eq(schema.settlements.settledAt, "PAID")
      )
    )
    .all();

  // Settlements: user paid friend
  const settlementsFromUser = db
    .select({ amount: schema.settlements.amount })
    .from(schema.settlements)
    .where(
      and(
        eq(schema.settlements.fromUserId, userId),
        eq(schema.settlements.toUserId, friendId),
        eq(schema.settlements.settledAt, "PAID")
      )
    )
    .all();

  const friendOwes = paidByUser.reduce((sum, r) => sum + r.shareAmount, 0);
  const userOwes = paidByFriend.reduce((sum, r) => sum + r.shareAmount, 0);
  const friendAlreadyPaid = settlementsToUser.reduce((sum, r) => sum + r.amount, 0);
  const userAlreadyPaid = settlementsFromUser.reduce((sum, r) => sum + r.amount, 0);

  // Net: friendOwes (to user) - userOwes (to friend) - already settled
  return friendOwes - userOwes + friendAlreadyPaid - userAlreadyPaid;
}
