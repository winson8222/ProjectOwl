import { getDb, schema } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export type User = typeof schema.users.$inferSelect;
export type NewUser = typeof schema.users.$inferInsert;
export type FriendWithBalance = User & { balance: number };

/** Get all users. */
export async function getUsers(): Promise<User[]> {
  return getDb().select().from(schema.users);
}

/** Get a single user by ID. */
export async function getUser(id: string): Promise<User | undefined> {
  const rows = await getDb().select().from(schema.users).where(eq(schema.users.id, id));
  return rows[0];
}

/** Create a new user. */
export async function createUser(name: string, email: string): Promise<User> {
  const id = `user-${uuid().slice(0, 8)}`;
  await getDb().insert(schema.users).values({ id, name, email });
  return { id, name, email, avatarUrl: null, createdAt: new Date().toISOString() };
}

/** Get all friends for a user (with net balance). */
export async function getFriends(userId: string): Promise<FriendWithBalance[]> {
  const db = getDb();

  // Get friend IDs
  const rows = await db
    .select({ friendId: schema.friendships.friendId })
    .from(schema.friendships)
    .where(eq(schema.friendships.userId, userId));

  if (rows.length === 0) return [];

  const friendIds = rows.map((r) => r.friendId);
  const friends = await db
    .select()
    .from(schema.users)
    .where(inArray(schema.users.id, friendIds));

  // For each friend, compute net balance
  const result: FriendWithBalance[] = [];
  for (const f of friends) {
    result.push({ ...f, balance: await computeBalanceWithUser(userId, f.id) });
  }
  return result;
}

/** Compute net balance between two users (positive = friend owes user). */
async function computeBalanceWithUser(userId: string, friendId: string): Promise<number> {
  const db = getDb();

  // Get all shares where this friend participated, paid by userId
  const paidByUser = await db
    .select({
      shareAmount: schema.participants.shareAmount,
    })
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
    );

  // Get all shares where user participated, paid by friend
  const paidByFriend = await db
    .select({
      shareAmount: schema.participants.shareAmount,
    })
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
    );

  // Settlements: friend paid user
  const settlementsToUser = await db
    .select({ amount: schema.settlements.amount })
    .from(schema.settlements)
    .where(
      and(
        eq(schema.settlements.fromUserId, friendId),
        eq(schema.settlements.toUserId, userId),
        eq(schema.settlements.settledAt, "PAID")
      )
    );

  // Settlements: user paid friend
  const settlementsFromUser = await db
    .select({ amount: schema.settlements.amount })
    .from(schema.settlements)
    .where(
      and(
        eq(schema.settlements.fromUserId, userId),
        eq(schema.settlements.toUserId, friendId),
        eq(schema.settlements.settledAt, "PAID")
      )
    );

  const friendOwes = paidByUser.reduce((sum, r) => sum + r.shareAmount, 0);
  const userOwes = paidByFriend.reduce((sum, r) => sum + r.shareAmount, 0);
  const friendAlreadyPaid = settlementsToUser.reduce((sum, r) => sum + r.amount, 0);
  const userAlreadyPaid = settlementsFromUser.reduce((sum, r) => sum + r.amount, 0);

  // Net: friendOwes (to user) - userOwes (to friend) - already settled
  return friendOwes - userOwes - friendAlreadyPaid + userAlreadyPaid;
}
