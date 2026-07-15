import { getDb, schema } from "@/lib/db";
import { eq, desc, and, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
/** Return the current datetime as a local-time ISO string (no timezone suffix, sorts lexicographically). */
function localTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}


export type Transaction = typeof schema.transactions.$inferSelect;

export interface TransactionWithDetails extends Transaction {
  items: (typeof schema.transactionItems.$inferSelect)[];
  paidByUser: typeof schema.users.$inferSelect | undefined;
  participants: { user: typeof schema.users.$inferSelect; shareAmount: number }[];
  itemAssignments: (typeof schema.itemAssignments.$inferSelect & { userName: string })[];
  userShare: number; // current user's share
}

export interface CreateTransactionInput {
  title: string;
  totalAmount: number;
  paidByUserId: string;
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
export function createTransaction(input: CreateTransactionInput): Transaction {
  const db = getDb();
  const txId = `tx-${uuid().slice(0, 12)}`;

  db.transaction(() => {
    // Insert the transaction
    db.insert(schema.transactions).values({
      id: txId,
      title: input.title,
      totalAmount: input.totalAmount,
      paidByUserId: input.paidByUserId,
      transactionDate: input.transactionDate,
      notes: input.notes ?? null,
      receiptImage: input.receiptImage ?? null,
      createdAt: localTimestamp(),
    }).run();

    // Insert items — descriptive line items only, no split data attached
    const insertedItemIds: string[] = [];
    for (const item of input.items ?? []) {
      const itemId = `item-${uuid().slice(0, 8)}`;
      insertedItemIds.push(itemId);
      db.insert(schema.transactionItems).values({
        id: itemId,
        transactionId: txId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }).run();
    }

    // Insert item-level assignments (from scan allocation)
    for (let i = 0; i < (input.itemAssignments?.length ?? 0); i++) {
      const assignments = input.itemAssignments![i];
      if (!assignments || assignments.length === 0) continue;
      const itemId = insertedItemIds[i];
      if (!itemId) continue;
      for (const assignment of assignments) {
        db.insert(schema.itemAssignments).values({
          id: `ia-${uuid().slice(0, 8)}`,
          itemId,
          userId: assignment.userId,
          shareAmount: assignment.shareAmount,
        }).run();
      }
    }

    // Insert participants — the split, once, for the whole transaction
    for (const participant of input.participants) {
      db.insert(schema.participants).values({
        id: uuid(),
        transactionId: txId,
        userId: participant.userId,
        shareAmount: participant.shareAmount,
      }).run();
    }
  });

  return db.select().from(schema.transactions).where(eq(schema.transactions.id, txId)).get()!;
}

/** Get a single transaction with all details. */
export function getTransaction(id: string, currentUserId?: string): TransactionWithDetails | undefined {
  const db = getDb();

  const tx = db
    .select()
    .from(schema.transactions)
    .where(and(eq(schema.transactions.id, id), eq(schema.transactions.isDeleted, false)))
    .get();
  if (!tx) return undefined;

  const paidByUser = db.select().from(schema.users).where(eq(schema.users.id, tx.paidByUserId)).get();

  const items = db
    .select()
    .from(schema.transactionItems)
    .where(eq(schema.transactionItems.transactionId, id))
    .all();

  const participantRows = db
    .select()
    .from(schema.participants)
    .where(eq(schema.participants.transactionId, id))
    .all();

  const userShares = participantRows.map((p) => {
    const user = db.select().from(schema.users).where(eq(schema.users.id, p.userId)).get();
    return { user: user!, shareAmount: p.shareAmount };
  });

  // Load item-level assignments with user names
  const rawAssignments = db
    .select()
    .from(schema.itemAssignments)
    .where(
      inArray(
        schema.itemAssignments.itemId,
        items.map((i) => i.id)
      )
    )
    .all();

  const itemAssignments = rawAssignments.map((a) => {
    const u = db.select().from(schema.users).where(eq(schema.users.id, a.userId)).get();
    return { ...a, userName: u?.name ?? "Unknown" };
  });

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
  };
}

/** Query transactions visible to a user with optional filters. */
export function getTransactions(params: {
  userId: string;
  payer?: string; // filter by who paid
  payees?: string[]; // filter by who's involved
  limit?: number;
  offset?: number;
}): TransactionWithDetails[] {
  const db = getDb();
  const { userId, payer, payees, limit = 50, offset = 0 } = params;

  // Get transaction IDs where this user is a participant
  const involvement = db
    .select({ transactionId: schema.participants.transactionId })
    .from(schema.participants)
    .where(eq(schema.participants.userId, userId))
    .all();

  // Also include transactions the user paid for (even if not a participant)
  const paidTxIds = db
    .select({ id: schema.transactions.id })
    .from(schema.transactions)
    .where(eq(schema.transactions.paidByUserId, userId))
    .all();

  const txIds = [
    ...new Set([
      ...involvement.map((r) => r.transactionId),
      ...paidTxIds.map((r) => r.id),
    ]),
  ];
  if (txIds.length === 0) return [];

  const txs = db
    .select()
    .from(schema.transactions)
    .where(
      and(
        inArray(schema.transactions.id, txIds),
        eq(schema.transactions.isDeleted, false),
        payer ? eq(schema.transactions.paidByUserId, payer) : undefined,
      )
    )
    .orderBy(desc(schema.transactions.transactionDate)) // Sort by transaction date (latest first)
    .limit(limit)
    .offset(offset)
    .all();

  return txs.map((tx) => {
    const items = db
      .select()
      .from(schema.transactionItems)
      .where(eq(schema.transactionItems.transactionId, tx.id))
      .all();

    const participantRows = db
      .select()
      .from(schema.participants)
      .where(eq(schema.participants.transactionId, tx.id))
      .all();

    const paidByUser = db.select().from(schema.users).where(eq(schema.users.id, tx.paidByUserId)).get();

    const userShares = participantRows.map((p) => {
      const user = db.select().from(schema.users).where(eq(schema.users.id, p.userId)).get();
      return { user: user!, shareAmount: p.shareAmount };
    });

    // Load item-level assignments
    const rawAssignments = db
      .select()
      .from(schema.itemAssignments)
      .where(
        inArray(
          schema.itemAssignments.itemId,
          items.map((i) => i.id)
        )
      )
      .all();

    const itemAssignments = rawAssignments.map((a) => {
      const u = db.select().from(schema.users).where(eq(schema.users.id, a.userId)).get();
      return { ...a, userName: u?.name ?? "Unknown" };
    });

    const userShare = participantRows.find((p) => p.userId === userId)?.shareAmount ?? 0;

    return {
      ...tx,
      items,
      paidByUser,
      participants: userShares,
      itemAssignments,
      userShare,
    };
  });
}

/** Soft-delete a transaction — the row (and its items/participants) stays for
 * ledger history but is excluded from balance and history queries. */
export function deleteTransaction(id: string): boolean {
  const db = getDb();
  const result = db
    .update(schema.transactions)
    .set({ isDeleted: true, updatedAt: localTimestamp() })
    .where(eq(schema.transactions.id, id))
    .run();
  return result.changes > 0;
}
