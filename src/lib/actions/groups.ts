import { getDb, schema } from "@/lib/db";
import { eq, and, inArray, desc, getTableColumns } from "drizzle-orm";
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
export async function getGroupMemberIds(groupId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ userId: schema.groupMembers.userId })
    .from(schema.groupMembers)
    .where(eq(schema.groupMembers.groupId, groupId));
  return rows.map((r) => r.userId);
}

/** True when every given user is a member of the group. */
export async function areGroupMembers(groupId: string, userIds: string[]): Promise<boolean> {
  const members = new Set(await getGroupMemberIds(groupId));
  return userIds.every((id) => members.has(id));
}

async function getMembers(groupId: string): Promise<User[]> {
  return getDb()
    .select(getTableColumns(schema.users))
    .from(schema.users)
    .innerJoin(schema.groupMembers, eq(schema.groupMembers.userId, schema.users.id))
    .where(eq(schema.groupMembers.groupId, groupId));
}

/**
 * Group transactions as SimpleTransactions (payer + participant shares).
 * Two round trips total: all transactions, then all their participants in
 * one IN query (previously one query per transaction — the dominant cost of
 * every balance-reading page on a remote database).
 */
async function getGroupSimpleTransactions(groupId: string): Promise<SimpleTransaction[]> {
  const db = getDb();
  const txs = await db
    .select({ id: schema.transactions.id, paidBy: schema.transactions.paidByUserId })
    .from(schema.transactions)
    .where(and(eq(schema.transactions.groupId, groupId), eq(schema.transactions.isDeleted, false)));
  if (txs.length === 0) return [];

  const parts = await db
    .select({
      transactionId: schema.participants.transactionId,
      userId: schema.participants.userId,
      shareAmount: schema.participants.shareAmount,
    })
    .from(schema.participants)
    .where(inArray(schema.participants.transactionId, txs.map((t) => t.id)));

  const byTx = new Map<string, { userId: string; shareAmount: number }[]>();
  for (const p of parts) {
    const list = byTx.get(p.transactionId) ?? [];
    list.push({ userId: p.userId, shareAmount: p.shareAmount });
    byTx.set(p.transactionId, list);
  }
  return txs.map((tx) => ({ paidBy: tx.paidBy, participants: byTx.get(tx.id) ?? [] }));
}

type PaidSettlement = typeof schema.settlements.$inferSelect;

/** All PAID settlements of a group. */
async function getPaidSettlements(groupId: string): Promise<PaidSettlement[]> {
  return getDb()
    .select()
    .from(schema.settlements)
    .where(and(eq(schema.settlements.groupId, groupId), eq(schema.settlements.settledAt, "PAID")));
}

/**
 * Pure fold of a group's raw data into per-member nets — callers fetch the
 * (members, transactions, settlements) trio once, in parallel, and reuse it.
 */
function computeMemberNets(
  members: User[],
  txs: SimpleTransaction[],
  settlements: PaidSettlement[]
): MemberBalance[] {
  const net = new Map<string, number>();
  for (const m of members) net.set(m.id, 0);
  for (const b of computeNetBalances(txs)) {
    net.set(b.userId, (net.get(b.userId) ?? 0) + b.amount);
  }

  // A paid settlement reduces the payer's debt and the recipient's credit.
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

/** The (members, transactions, PAID settlements) trio, fetched in parallel. */
async function getGroupLedger(groupId: string) {
  const [members, txs, settlements] = await Promise.all([
    getMembers(groupId),
    getGroupSimpleTransactions(groupId),
    getPaidSettlements(groupId),
  ]);
  return { members, txs, settlements };
}

/**
 * Net position of every group member, from the group's transactions and
 * settled payments. Positive = gets back money, negative = owes money.
 */
export async function getGroupNetBalances(groupId: string): Promise<MemberBalance[]> {
  const { members, txs, settlements } = await getGroupLedger(groupId);
  return computeMemberNets(members, txs, settlements);
}

/**
 * "Most down bad" ranking: members who owe the most in this group,
 * biggest debtor first.
 */
export async function getGroupDownBadRanking(groupId: string): Promise<MemberBalance[]> {
  return (await getGroupNetBalances(groupId))
    .filter((b) => b.net < -0.005)
    .sort((a, b) => a.net - b.net);
}

/** Minimum-transfer settlement plan within one group (settlements included). */
export async function getGroupTransferPlan(groupId: string): Promise<(Transfer & { fromUser: User; toUser: User })[]> {
  const { members, txs, settlements } = await getGroupLedger(groupId);
  const balances = computeMemberNets(members, txs, settlements).map((b) => ({ userId: b.user.id, amount: b.net }));
  const transfers = minimizeTransfers(balances);
  const byId = new Map(members.map((m) => [m.id, m]));
  return transfers
    .filter((t) => byId.has(t.from) && byId.has(t.to))
    .map((t) => ({ ...t, fromUser: byId.get(t.from)!, toUser: byId.get(t.to)! }));
}

/** All groups a user belongs to, with members and the user's net position. */
export async function getGroupsForUser(userId: string): Promise<GroupSummary[]> {
  const db = getDb();
  const memberships = await db
    .select({ groupId: schema.groupMembers.groupId })
    .from(schema.groupMembers)
    .where(eq(schema.groupMembers.userId, userId));
  if (memberships.length === 0) return [];

  const groups = await db
    .select()
    .from(schema.groups)
    .where(inArray(schema.groups.id, memberships.map((m) => m.groupId)))
    .orderBy(desc(schema.groups.createdAt));

  // All groups in parallel; each group's ledger is one parallel trio and
  // doubles as members list + transaction count (no extra queries).
  return Promise.all(
    groups.map(async (g): Promise<GroupSummary> => {
      const { members, txs, settlements } = await getGroupLedger(g.id);
      const yourNet = computeMemberNets(members, txs, settlements)
        .find((b) => b.user.id === userId)?.net ?? 0;
      return {
        ...g,
        members,
        yourNet,
        transactionCount: txs.length,
        isSettled: txs.length > 0 && Math.abs(yourNet) < 0.005,
      };
    })
  );
}

/** Full detail for the group page. */
export async function getGroupDetail(groupId: string, currentUserId: string): Promise<GroupDetail | undefined> {
  const db = getDb();
  const [groupRows, { members, txs, settlements }] = await Promise.all([
    db.select().from(schema.groups).where(eq(schema.groups.id, groupId)),
    getGroupLedger(groupId),
  ]);
  const group = groupRows[0];
  if (!group) return undefined;

  const memberBalances = computeMemberNets(members, txs, settlements);

  // Pairwise nets vs. the current user: who owes you / you owe within the group.
  const pairwise = new Map<string, number>();
  for (const tx of txs) {
    for (const p of tx.participants) {
      if (p.userId === tx.paidBy) continue;
      if (tx.paidBy === currentUserId && p.userId !== currentUserId) {
        pairwise.set(p.userId, (pairwise.get(p.userId) ?? 0) + p.shareAmount);
      } else if (p.userId === currentUserId) {
        pairwise.set(tx.paidBy, (pairwise.get(tx.paidBy) ?? 0) - p.shareAmount);
      }
    }
  }
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
export async function createGroup(name: string, createdByUserId: string, memberIds: string[], color?: string): Promise<Group> {
  const db = getDb();
  const id = `group-${uuid().slice(0, 8)}`;
  const allMembers = [...new Set([createdByUserId, ...memberIds])];
  const chosenColor =
    color ?? GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)];

  await db.transaction(async (tx) => {
    await tx.insert(schema.groups).values({
      id,
      name,
      color: chosenColor,
      createdByUserId,
      createdAt: localTimestamp(),
    });
    for (const userId of allMembers) {
      await tx.insert(schema.groupMembers).values({
        id: `gm-${uuid().slice(0, 8)}`,
        groupId: id,
        userId,
        createdAt: localTimestamp(),
      });
    }
  });

  await logActivity({ type: "group_created", userId: createdByUserId, groupId: id });
  for (const userId of allMembers) {
    if (userId === createdByUserId) continue;
    await logActivity({ type: "member_added", userId: createdByUserId, relatedUserId: userId, groupId: id });
  }

  return (await db.select().from(schema.groups).where(eq(schema.groups.id, id)))[0]!;
}

/** Add users to a group (already-present members are skipped). */
export async function addGroupMembers(groupId: string, userIds: string[], actorId: string): Promise<User[]> {
  const db = getDb();
  const existing = new Set(await getGroupMemberIds(groupId));
  const toAdd = [...new Set(userIds)].filter((id) => !existing.has(id));

  for (const userId of toAdd) {
    await db.insert(schema.groupMembers).values({
      id: `gm-${uuid().slice(0, 8)}`,
      groupId,
      userId,
      createdAt: localTimestamp(),
    });
    await logActivity({ type: "member_added", userId: actorId, relatedUserId: userId, groupId });
  }

  return getMembers(groupId);
}
