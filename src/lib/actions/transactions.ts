import { getDb, schema } from "@/lib/db";
import { eq, desc, and, like, inArray, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
/** Return the current datetime as a local-time ISO string (no timezone suffix, sorts lexicographically). */
function localTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}


export type Transaction = typeof schema.transactions.$inferSelect;
export type TransactionItem = typeof schema.transactions.$inferInsert &
  { items: (typeof schema.transactionItems.$inferSelect & {
    assignments: typeof schema.itemAssignments.$inferSelect[]
  })[] };

export interface TransactionWithDetails extends Transaction {
  items: (typeof schema.transactionItems.$inferSelect & {
    assignments: typeof schema.itemAssignments.$inferSelect[];
  })[];
  paidByUser: typeof schema.users.$inferSelect | undefined;
  participants: { user: typeof schema.users.$inferSelect; shareAmount: number }[];
  userShare: number; // current user's share
}

export interface CreateTransactionInput {
  title: string;
  totalAmount: number;
  paidByUserId: string;
  transactionDate: string;
  notes?: string;
  receiptImage?: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    assignments: { userId: string; shareAmount: number }[];
  }[];
}

export enum TransactionStatus {
  Pending = "pending",
  Settled = "settled",
}

/** Create a full transaction with items and assignments. */
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

    // Insert items and their assignments
    for (const item of input.items) {
      const itemId = `item-${uuid().slice(0, 8)}`;
      db.insert(schema.transactionItems).values({
        id: itemId,
        transactionId: txId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }).run();

      for (const assignment of item.assignments) {
        db.insert(schema.itemAssignments).values({
          id: uuid(),
          itemId,
          userId: assignment.userId,
          shareAmount: assignment.shareAmount,
        }).run();
      }
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

  const itemsWithAssignments = items.map((item) => {
    const assignments = db
      .select()
      .from(schema.itemAssignments)
      .where(eq(schema.itemAssignments.itemId, item.id))
      .all();
    return { ...item, assignments };
  });

  // Compute per-participant totals
  const participantMap = new Map<string, number>();
  for (const item of itemsWithAssignments) {
    for (const a of item.assignments) {
      participantMap.set(a.userId, (participantMap.get(a.userId) ?? 0) + a.shareAmount);
    }
  }

  const userShares = Array.from(participantMap.entries()).map(([userId, shareAmount]) => {
    const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    return { user: user!, shareAmount };
  });

  const userShare = currentUserId ? (participantMap.get(currentUserId) ?? 0) : 0;

  return {
    ...tx,
    items: itemsWithAssignments,
    paidByUser,
    participants: userShares,
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

  // Get transaction IDs where this user has assignments (as a participant)
  const involvement = db
    .select({ transactionId: schema.transactionItems.transactionId })
    .from(schema.itemAssignments)
    .innerJoin(
      schema.transactionItems,
      eq(schema.itemAssignments.itemId, schema.transactionItems.id)
    )
    .where(eq(schema.itemAssignments.userId, userId))
    .all();

  // Also include transactions the user paid for (even if not in assignments)
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

  let query = db
    .select()
    .from(schema.transactions)
    .where(
      and(
        inArray(schema.transactions.id, txIds),
        eq(schema.transactions.isDeleted, false),
        payer ? eq(schema.transactions.paidByUserId, payer) : undefined,
      )
    )
    .orderBy(desc(schema.transactions.createdAt))
    .limit(limit)
    .offset(offset);

  const txs = query.all();

  return txs.map((tx) => {
    const items = db
      .select()
      .from(schema.transactionItems)
      .where(eq(schema.transactionItems.transactionId, tx.id))
      .all();

    const itemsWithAssignments = items.map((item) => {
      const assignments = db
        .select()
        .from(schema.itemAssignments)
        .where(eq(schema.itemAssignments.itemId, item.id))
        .all();
      return { ...item, assignments };
    });

    const paidByUser = db.select().from(schema.users).where(eq(schema.users.id, tx.paidByUserId)).get();

    const participantMap = new Map<string, number>();
    for (const item of itemsWithAssignments) {
      for (const a of item.assignments) {
        participantMap.set(a.userId, (participantMap.get(a.userId) ?? 0) + a.shareAmount);
      }
    }

    const userShares = Array.from(participantMap.entries()).map(([uid, shareAmount]) => {
      const user = db.select().from(schema.users).where(eq(schema.users.id, uid)).get();
      return { user: user!, shareAmount };
    });

    const userShare = participantMap.get(userId) ?? 0;

    return {
      ...tx,
      items: itemsWithAssignments,
      paidByUser,
      participants: userShares,
      userShare,
    };
  });
}

/** Soft-delete a transaction — the row (and its items/assignments) stays for
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
