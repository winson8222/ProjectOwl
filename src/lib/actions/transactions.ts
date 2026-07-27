import { getDb, schema } from "@/lib/db";
import { eq, desc, and, inArray, getTableColumns } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { localTimestamp } from "@/lib/time";
import { logActivity } from "./activities";


export type Transaction = typeof schema.transactions.$inferSelect;

export interface TransactionWithDetails extends Transaction {
  items: (typeof schema.transactionItems.$inferSelect)[];
  paidByUser: typeof schema.users.$inferSelect | undefined;
  participants: { user: typeof schema.users.$inferSelect; shareAmount: number }[];
  itemAssignments: (typeof schema.itemAssignments.$inferSelect & { userName: string })[];
  userShare: number; // current user's share
  groupName: string | null;
}

export interface CreateTransactionInput {
  title: string;
  /** "expense" (default) = shared cost split between participants.
   *  "payment" = direct user→user payment; the sole participant is the recipient. */
  type?: "expense" | "payment";
  totalAmount: number;
  paidByUserId: string;
  /** The group this transaction happens in — every transaction lives in a group. */
  groupId: string;
  transactionDate: string;
  notes?: string;
  receiptImage?: string;
  items?: {
    name: string;
    quantity: number;
    price: number;
  }[];
  participants: { userId: string; shareAmount: number }[];
  /** Optional item-level assignments from receipt scanning.
   *  Each entry ties a user to a specific item and their share of that item's price. */
  itemAssignments?: {
    userId: string;
    shareAmount: number;
  }[][]; // index matches items[] — array of assignments per item
}

/** Create a full transaction with its (unsplit) line items, item-level assignments, and participant shares. */
export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const db = getDb();
  const txId = `tx-${uuid().slice(0, 12)}`;

  await db.transaction(async (tx) => {
    // Insert the transaction
    await tx.insert(schema.transactions).values({
      id: txId,
      title: input.title,
      type: input.type ?? "expense",
      totalAmount: input.totalAmount,
      paidByUserId: input.paidByUserId,
      groupId: input.groupId,
      transactionDate: input.transactionDate,
      notes: input.notes ?? null,
      receiptImage: input.receiptImage ?? null,
      createdAt: localTimestamp(),
    });

    // Insert items — descriptive line items only, no split data attached
    const insertedItemIds: string[] = [];
    for (const item of input.items ?? []) {
      // Skip items with empty names to prevent NOT NULL constraint failures
      if (!item.name || item.name.trim() === '') {
        console.warn('Skipping item with empty name:', item);
        continue;
      }

      const itemId = `item-${uuid().slice(0, 8)}`;
      insertedItemIds.push(itemId);
      await tx.insert(schema.transactionItems).values({
        id: itemId,
        transactionId: txId,
        name: item.name.trim(), // Trim whitespace from item names
        quantity: item.quantity,
        price: item.price,
      });
    }

    // Insert item-level assignments (from scan allocation)
    for (let i = 0; i < (input.itemAssignments?.length ?? 0); i++) {
      const assignments = input.itemAssignments![i];
      if (!assignments || assignments.length === 0) continue;
      const itemId = insertedItemIds[i];
      if (!itemId) continue;
      for (const assignment of assignments) {
        await tx.insert(schema.itemAssignments).values({
          id: `ia-${uuid().slice(0, 8)}`,
          itemId,
          userId: assignment.userId,
          shareAmount: assignment.shareAmount,
        });
      }
    }

    // Insert participants — the split, once, for the whole transaction
    for (const participant of input.participants) {
      await tx.insert(schema.participants).values({
        id: uuid(),
        transactionId: txId,
        userId: participant.userId,
        shareAmount: participant.shareAmount,
      });
    }
  });

  await logActivity({
    type: input.type === "payment" ? "payment" : "transaction",
    userId: input.paidByUserId,
    // A payment's recipient is its sole participant.
    relatedUserId: input.type === "payment" ? input.participants[0]?.userId : undefined,
    amount: input.totalAmount,
    groupId: input.groupId,
    transactionId: txId,
  });

  return (await db.select().from(schema.transactions).where(eq(schema.transactions.id, txId)))[0]!;
}

/** Look up a group's name (null when the transaction predates groups). */
async function groupNameFor(groupId: string | null): Promise<string | null> {
  if (!groupId) return null;
  const g = (await getDb().select().from(schema.groups).where(eq(schema.groups.id, groupId)))[0];
  return g?.name ?? null;
}

/** Get a single transaction with all details. */
export async function getTransaction(id: string, currentUserId?: string): Promise<TransactionWithDetails | undefined> {
  const db = getDb();

  const tx = (await db
    .select()
    .from(schema.transactions)
    .where(and(eq(schema.transactions.id, id), eq(schema.transactions.isDeleted, false))))[0];
  if (!tx) return undefined;

  const paidByUser = (await db.select().from(schema.users).where(eq(schema.users.id, tx.paidByUserId)))[0];

  const items = await db
    .select()
    .from(schema.transactionItems)
    .where(eq(schema.transactionItems.transactionId, id));

  const participantRows = await db
    .select()
    .from(schema.participants)
    .where(eq(schema.participants.transactionId, id));

  const userShares = [];
  for (const p of participantRows) {
    const user = (await db.select().from(schema.users).where(eq(schema.users.id, p.userId)))[0];
    userShares.push({ user: user!, shareAmount: p.shareAmount });
  }

  // Load item-level assignments with user names
  const rawAssignments = items.length === 0 ? [] : await db
    .select()
    .from(schema.itemAssignments)
    .where(
      inArray(
        schema.itemAssignments.itemId,
        items.map((i) => i.id)
      )
    );

  const itemAssignments = [];
  for (const a of rawAssignments) {
    const u = (await db.select().from(schema.users).where(eq(schema.users.id, a.userId)))[0];
    itemAssignments.push({ ...a, userName: u?.name ?? "Unknown" });
  }

  const userShare = currentUserId
    ? (participantRows.find((p) => p.userId === currentUserId)?.shareAmount ?? 0)
    : 0;

  return {
    ...tx,
    items,
    paidByUser,
    participants: userShares,
    itemAssignments,
    userShare,
    groupName: await groupNameFor(tx.groupId),
  };
}

/** Query transactions visible to a user with optional filters.
 *  When `groupId` is given, returns ALL of that group's transactions
 *  (members see the whole group ledger, not just their own involvement). */
export async function getTransactions(params: {
  userId: string;
  groupId?: string; // scope to one group
  payer?: string; // filter by who paid
  payees?: string[]; // filter by who's involved
  limit?: number;
  offset?: number;
}): Promise<TransactionWithDetails[]> {
  const db = getDb();
  const { userId, groupId, payer, payees, limit = 50, offset = 0 } = params;

  let txIds: string[] | undefined;
  if (!groupId) {
    // Get transaction IDs where this user is a participant
    const involvement = await db
      .select({ transactionId: schema.participants.transactionId })
      .from(schema.participants)
      .where(eq(schema.participants.userId, userId));

    // Also include transactions the user paid for (even if not a participant)
    const paidTxIds = await db
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(eq(schema.transactions.paidByUserId, userId));

    txIds = [
      ...new Set([
        ...involvement.map((r) => r.transactionId),
        ...paidTxIds.map((r) => r.id),
      ]),
    ];
    if (txIds.length === 0) return [];
  }

  const txs = await db
    .select()
    .from(schema.transactions)
    .where(
      and(
        txIds ? inArray(schema.transactions.id, txIds) : undefined,
        groupId ? eq(schema.transactions.groupId, groupId) : undefined,
        eq(schema.transactions.isDeleted, false),
        payer ? eq(schema.transactions.paidByUserId, payer) : undefined,
      )
    )
    .orderBy(desc(schema.transactions.createdAt)) // Sort by creation timestamp (latest first)
    .limit(limit)
    .offset(offset);

  if (txs.length === 0) return [];

  // Batch everything: previously each transaction cost 5+ serial queries
  // (items, participants, payer, one per participant user, one per
  // assignment user, group name) — ~180 round trips for a 20-tx ledger.
  // Now it's three stages of IN queries regardless of list size.
  const listIds = txs.map((t) => t.id);
  const [allItems, allParticipants, allAssignments] = await Promise.all([
    db.select().from(schema.transactionItems)
      .where(inArray(schema.transactionItems.transactionId, listIds)),
    db.select().from(schema.participants)
      .where(inArray(schema.participants.transactionId, listIds)),
    db.select({
        ...getTableColumns(schema.itemAssignments),
        transactionId: schema.transactionItems.transactionId,
      })
      .from(schema.itemAssignments)
      .innerJoin(schema.transactionItems, eq(schema.itemAssignments.itemId, schema.transactionItems.id))
      .where(inArray(schema.transactionItems.transactionId, listIds)),
  ]);

  const userIds = [...new Set([
    ...txs.map((t) => t.paidByUserId),
    ...allParticipants.map((p) => p.userId),
    ...allAssignments.map((a) => a.userId),
  ])];
  const groupIds = [...new Set(txs.map((t) => t.groupId).filter((g): g is string => g !== null))];
  const [userRows, groupRows] = await Promise.all([
    db.select().from(schema.users).where(inArray(schema.users.id, userIds)),
    groupIds.length > 0
      ? db.select().from(schema.groups).where(inArray(schema.groups.id, groupIds))
      : Promise.resolve([]),
  ]);
  const usersById = new Map(userRows.map((u) => [u.id, u]));
  const groupNamesById = new Map(groupRows.map((g) => [g.id, g.name]));

  const groupByTx = <T extends { transactionId: string }>(rows: T[]): Map<string, T[]> => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const list = map.get(row.transactionId) ?? [];
      list.push(row);
      map.set(row.transactionId, list);
    }
    return map;
  };
  const itemsByTx = groupByTx(allItems);
  const participantsByTx = groupByTx(allParticipants);
  const assignmentsByTx = groupByTx(allAssignments);

  return txs.map((tx) => {
    const participantRows = participantsByTx.get(tx.id) ?? [];
    return {
      ...tx,
      items: itemsByTx.get(tx.id) ?? [],
      paidByUser: usersById.get(tx.paidByUserId),
      participants: participantRows.map((p) => ({
        user: usersById.get(p.userId)!,
        shareAmount: p.shareAmount,
      })),
      itemAssignments: (assignmentsByTx.get(tx.id) ?? []).map(({ transactionId: _txId, ...a }) => ({
        ...a,
        userName: usersById.get(a.userId)?.name ?? "Unknown",
      })),
      userShare: participantRows.find((p) => p.userId === userId)?.shareAmount ?? 0,
      groupName: tx.groupId ? groupNamesById.get(tx.groupId) ?? null : null,
    };
  });
}

/** Soft-delete a transaction — the row (and its items/participants) stays for
 * ledger history but is excluded from balance and history queries. */
export async function deleteTransaction(id: string): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(schema.transactions)
    .set({ isDeleted: true, updatedAt: localTimestamp() })
    .where(eq(schema.transactions.id, id))
    .returning({ id: schema.transactions.id });
  return updated.length > 0;
}
