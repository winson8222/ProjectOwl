import { getDb, schema } from "@/lib/db";
import { eq, desc, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { localTimestamp } from "@/lib/time";

export type ActivityType =
  | "transaction"
  | "payment"
  | "settlement"
  | "group_created"
  | "member_added"
  | "member_joined"; // joined on their own via an invite link

export interface ActivityWithDetails {
  id: string;
  type: ActivityType;
  userId: string;
  userName: string;
  relatedUserId: string | null;
  relatedUserName: string | null;
  amount: number | null;
  groupId: string;
  groupName: string;
  transactionId: string | null;
  transactionTitle: string | null;
  createdAt: string;
}

export interface LogActivityInput {
  type: ActivityType;
  userId: string; // the actor
  groupId: string;
  relatedUserId?: string;
  amount?: number;
  transactionId?: string;
}

/** Record one activity in a group's feed. */
export async function logActivity(input: LogActivityInput): Promise<void> {
  await getDb().insert(schema.activities).values({
    id: `act-${uuid().slice(0, 12)}`,
    type: input.type,
    userId: input.userId,
    relatedUserId: input.relatedUserId ?? null,
    amount: input.amount ?? null,
    groupId: input.groupId,
    transactionId: input.transactionId ?? null,
    createdAt: localTimestamp(),
  });
}

/** Activities across every group the user belongs to, newest first. */
export async function getActivitiesForUser(userId: string, limit = 50): Promise<ActivityWithDetails[]> {
  const db = getDb();

  const memberships = await db
    .select({ groupId: schema.groupMembers.groupId })
    .from(schema.groupMembers)
    .where(eq(schema.groupMembers.userId, userId));
  const groupIds = memberships.map((m) => m.groupId);
  if (groupIds.length === 0) return [];

  const rows = await db
    .select()
    .from(schema.activities)
    .where(inArray(schema.activities.groupId, groupIds))
    .orderBy(desc(schema.activities.createdAt))
    .limit(limit);

  // Resolve names with small lookup caches (feed sizes are tiny).
  const userCache = new Map<string, string>();
  const userName = async (id: string | null): Promise<string | null> => {
    if (!id) return null;
    if (!userCache.has(id)) {
      const u = (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0];
      userCache.set(id, u?.name ?? "Unknown");
    }
    return userCache.get(id)!;
  };
  const groupCache = new Map<string, string>();
  const groupName = async (id: string): Promise<string> => {
    if (!groupCache.has(id)) {
      const g = (await db.select().from(schema.groups).where(eq(schema.groups.id, id)))[0];
      groupCache.set(id, g?.name ?? "Unknown group");
    }
    return groupCache.get(id)!;
  };
  const txCache = new Map<string, string | null>();
  const txTitle = async (id: string | null): Promise<string | null> => {
    if (!id) return null;
    if (!txCache.has(id)) {
      const t = (await db.select().from(schema.transactions).where(eq(schema.transactions.id, id)))[0];
      txCache.set(id, t?.title ?? null);
    }
    return txCache.get(id)!;
  };

  const result: ActivityWithDetails[] = [];
  for (const a of rows) {
    result.push({
      id: a.id,
      type: a.type as ActivityType,
      userId: a.userId,
      userName: (await userName(a.userId))!,
      relatedUserId: a.relatedUserId,
      relatedUserName: await userName(a.relatedUserId),
      amount: a.amount,
      groupId: a.groupId,
      groupName: await groupName(a.groupId),
      transactionId: a.transactionId,
      transactionTitle: await txTitle(a.transactionId),
      createdAt: a.createdAt,
    });
  }
  return result;
}
