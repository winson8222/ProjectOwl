import { getDb, schema } from "@/lib/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { localTimestamp } from "@/lib/time";
import { logActivity } from "./activities";
import { computeNetBalances, minimizeTransfers, type SimpleTransaction, type Transfer } from "@/lib/simplify";
import type { User } from "./users";

export type Group = typeof schema.groups.$inferSelect;

/** Palette for group avatar circles (mock uses red/blue/yellow). */
export const GROUP_COLORS = ["#f87171", "#60a5fa", "#fbbf24", "#34d399", "#a78bfa", "#f472b6"];

export interface GroupSummary extends Group {
  members: User[];
  /** Current user's net position inside this group (positive = owed money). */
  yourNet: number;
  transactionCount: number;
  /** True when the group has history but the current user's net is ~zero. */
  isSettled: boolean;
}

export interface MemberBalance {
  user: User;
  /** Positive = gets back money, negative = owes money. */
  net: number;
}

export interface GroupDetail extends Group {
  members: User[];
  memberBalances: MemberBalance[];
  /** Pairwise nets vs. the current user (positive = they owe you). */
  yourPairwise: { user: User; amount: number }[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** All member user-ids of a group. */
export function getGroupMemberIds(groupId: string): string[] {
  return getDb()
    .select({ userId: schema.groupMembers.userId })
    .from(schema.groupMembers)
    .where(eq(schema.groupMembers.groupId, groupId))
    .all()
    .map((r) => r.userId);
}

/** True when every given user is a member of the group. */
export function areGroupMembers(groupId: string, userIds: string[]): boolean {
  const members = new Set(getGroupMemberIds(groupId));
  return userIds.every((id) => members.has(id));
}

function getMembers(groupId: string): User[] {
  const db = getDb();
  const ids = getGroupMemberIds(groupId);
  if (ids.length === 0) return [];
  return db.select().from(schema.users).where(inArray(schema.users.id, ids)).all();
}

/** Group transactions as SimpleTransactions (payer + participant shares). */
function getGroupSimpleTransactions(groupId: string): SimpleTransaction[] {
  const db = getDb();
  const txs = db
    .select({ id: schema.transactions.id, paidBy: schema.transactions.paidByUserId })
    .from(schema.transactions)
    .where(and(eq(schema.transactions.groupId, groupId), eq(schema.transactions.isDeleted, false)))
    .all();

  return txs.map((tx) => ({
    paidBy: tx.paidBy,
    participants: db
      .select({ userId: schema.participants.userId, shareAmount: schema.participants.shareAmount })
      .from(schema.participants)
      .where(eq(schema.participants.transactionId, tx.id))
      .all(),
  }));
}

/**
 * Net position of every group member, from the group's transactions and
 * settled payments. Positive = gets back money, negative = owes money.
 */
export function getGroupNetBalances(groupId: string): MemberBalance[] {
  const db = getDb();
  const members = getMembers(groupId);

  const net = new Map<string, number>();
  for (const m of members) net.set(m.id, 0);
  for (const b of computeNetBalances(getGroupSimpleTransactions(groupId))) {
    net.set(b.userId, (net.get(b.userId) ?? 0) + b.amount);
  }

  // A paid settlement reduces the payer's debt and the recipient's credit.
  const settlements = db
    .select()
    .from(schema.settlements)
    .where(and(eq(schema.settlements.groupId, groupId), eq(schema.settlements.settledAt, "PAID")))
    .all();
  for (const s of settlements) {
    net.set(s.fromUserId, (net.get(s.fromUserId) ?? 0) + s.amount);
    net.set(s.toUserId, (net.get(s.toUserId) ?? 0) - s.amount);
  }

  const byId = new Map(members.map((m) => [m.id, m]));
  return [...net.entries()]
    .filter(([userId]) => byId.has(userId))
    .map(([userId, amount]) => ({ user: byId.get(userId)!, net: round2(amount) }))
    .sort((a, b) => b.net - a.net);
}

/**
 * "Most down bad" ranking: members who owe the most in this group,
 * biggest debtor first.
 */
export function getGroupDownBadRanking(groupId: string): MemberBalance[] {
  return getGroupNetBalances(groupId)
    .filter((b) => b.net < -0.005)
    .sort((a, b) => a.net - b.net);
}

/** Minimum-transfer settlement plan within one group (settlements included). */
export function getGroupTransferPlan(groupId: string): (Transfer & { fromUser: User; toUser: User })[] {
  const balances = getGroupNetBalances(groupId).map((b) => ({ userId: b.user.id, amount: b.net }));
  const transfers = minimizeTransfers(balances);
  const members = new Map(getMembers(groupId).map((m) => [m.id, m]));
  return transfers
    .filter((t) => members.has(t.from) && members.has(t.to))
    .map((t) => ({ ...t, fromUser: members.get(t.from)!, toUser: members.get(t.to)! }));
}

/** All groups a user belongs to, with members and the user's net position. */
export function getGroupsForUser(userId: string): GroupSummary[] {
  const db = getDb();
  const memberships = db
    .select({ groupId: schema.groupMembers.groupId })
    .from(schema.groupMembers)
    .where(eq(schema.groupMembers.userId, userId))
    .all();
  if (memberships.length === 0) return [];

  const groups = db
    .select()
    .from(schema.groups)
    .where(inArray(schema.groups.id, memberships.map((m) => m.groupId)))
    .orderBy(desc(schema.groups.createdAt))
    .all();

  return groups.map((g) => {
    const balances = getGroupNetBalances(g.id);
    const yourNet = balances.find((b) => b.user.id === userId)?.net ?? 0;
    const transactionCount = db
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.groupId, g.id), eq(schema.transactions.isDeleted, false)))
      .all().length;
    return {
      ...g,
      members: getMembers(g.id),
      yourNet,
      transactionCount,
      isSettled: transactionCount > 0 && Math.abs(yourNet) < 0.005,
    };
  });
}

/** Full detail for the group page. */
export function getGroupDetail(groupId: string, currentUserId: string): GroupDetail | undefined {
  const db = getDb();
  const group = db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).get();
  if (!group) return undefined;

  const members = getMembers(groupId);
  const memberBalances = getGroupNetBalances(groupId);

  // Pairwise nets vs. the current user: who owes you / you owe within the group.
  const pairwise = new Map<string, number>();
  for (const tx of getGroupSimpleTransactions(groupId)) {
    for (const p of tx.participants) {
      if (p.userId === tx.paidBy) continue;
      if (tx.paidBy === currentUserId && p.userId !== currentUserId) {
        pairwise.set(p.userId, (pairwise.get(p.userId) ?? 0) + p.shareAmount);
      } else if (p.userId === currentUserId) {
        pairwise.set(tx.paidBy, (pairwise.get(tx.paidBy) ?? 0) - p.shareAmount);
      }
    }
  }
  const settlements = db
    .select()
    .from(schema.settlements)
    .where(and(eq(schema.settlements.groupId, groupId), eq(schema.settlements.settledAt, "PAID")))
    .all();
  for (const s of settlements) {
    if (s.toUserId === currentUserId) {
      pairwise.set(s.fromUserId, (pairwise.get(s.fromUserId) ?? 0) - s.amount);
    } else if (s.fromUserId === currentUserId) {
      pairwise.set(s.toUserId, (pairwise.get(s.toUserId) ?? 0) + s.amount);
    }
  }
  const byId = new Map(members.map((m) => [m.id, m]));
  const yourPairwise = [...pairwise.entries()]
    .filter(([id, amt]) => byId.has(id) && Math.abs(amt) > 0.005)
    .map(([id, amt]) => ({ user: byId.get(id)!, amount: round2(amt) }))
    .sort((a, b) => b.amount - a.amount);

  return { ...group, members, memberBalances, yourPairwise };
}

/** Create a group with its initial members (creator always included). */
export function createGroup(name: string, createdByUserId: string, memberIds: string[], color?: string): Group {
  const db = getDb();
  const id = `group-${uuid().slice(0, 8)}`;
  const allMembers = [...new Set([createdByUserId, ...memberIds])];
  const chosenColor =
    color ?? GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)];

  db.transaction(() => {
    db.insert(schema.groups).values({
      id,
      name,
      color: chosenColor,
      createdByUserId,
      createdAt: localTimestamp(),
    }).run();
    for (const userId of allMembers) {
      db.insert(schema.groupMembers).values({
        id: `gm-${uuid().slice(0, 8)}`,
        groupId: id,
        userId,
        createdAt: localTimestamp(),
      }).run();
    }
  });

  logActivity({ type: "group_created", userId: createdByUserId, groupId: id });
  for (const userId of allMembers) {
    if (userId === createdByUserId) continue;
    logActivity({ type: "member_added", userId: createdByUserId, relatedUserId: userId, groupId: id });
  }

  return db.select().from(schema.groups).where(eq(schema.groups.id, id)).get()!;
}

/** Add users to a group (already-present members are skipped). */
export function addGroupMembers(groupId: string, userIds: string[], actorId: string): User[] {
  const db = getDb();
  const existing = new Set(getGroupMemberIds(groupId));
  const toAdd = [...new Set(userIds)].filter((id) => !existing.has(id));

  for (const userId of toAdd) {
    db.insert(schema.groupMembers).values({
      id: `gm-${uuid().slice(0, 8)}`,
      groupId,
      userId,
      createdAt: localTimestamp(),
    }).run();
    logActivity({ type: "member_added", userId: actorId, relatedUserId: userId, groupId });
  }

  return getMembers(groupId);
}
