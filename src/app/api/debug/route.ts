import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { count, sql, eq } from "drizzle-orm";
import { mapErrorMessage } from "@/lib/constants";
import { debugEndpointsEnabled } from "@/lib/debug-guard";

/** Shared 404 for when debug endpoints are disabled (production). */
function debugDisabled() {
  // 404, not 403 — don't reveal that these endpoints exist in production.
  return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
}

/**
 * GET /api/debug
 * Returns DB statistics for debugging. Dev-only — dumps every user and
 * transaction, so it is disabled outside development.
 */
export async function GET() {
  if (!debugEndpointsEnabled()) return debugDisabled();
  try {
    const db = getDb();

    const userCount = (await db.select({ count: count() }).from(schema.users))[0]?.count ?? 0;
    const txCount = (await db.select({ count: count() }).from(schema.transactions))[0]?.count ?? 0;
    const itemCount = (await db.select({ count: count() }).from(schema.transactionItems))[0]?.count ?? 0;
    const participantCount = (await db.select({ count: count() }).from(schema.participants))[0]?.count ?? 0;
    const settlementCount = (await db.select({ count: count() }).from(schema.settlements))[0]?.count ?? 0;

    const users = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users);
    const transactions = await db
      .select({
        id: schema.transactions.id,
        title: schema.transactions.title,
        totalAmount: schema.transactions.totalAmount,
        paidByUserId: schema.transactions.paidByUserId,
        createdAt: schema.transactions.createdAt,
      })
      .from(schema.transactions)
      .orderBy(sql`created_at DESC`);

    // Check participants per transaction
    const participantsPerTx = [];
    for (const tx of transactions) {
      const result = (await db
        .select({ total: count() })
        .from(schema.participants)
        .where(eq(schema.participants.transactionId, tx.id)))[0];
      participantsPerTx.push({ txId: tx.id, participantCount: result?.total ?? 0 });
    }

    return NextResponse.json({
      success: true,
      data: {
        counts: {
          users: userCount,
          transactions: txCount,
          transactionItems: itemCount,
          participants: participantCount,
          settlements: settlementCount,
        },
        users,
        transactions,
        participantsPerTx,
      },
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: mapErrorMessage(err),
    }, { status: 500 });
  }
}

/**
 * POST /api/debug?action=reset|delete-all-transactions
 */
export async function POST(request: Request) {
  if (!debugEndpointsEnabled()) return debugDisabled();
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    const db = getDb();

    if (action === "reset") {
      // TRUNCATE ... CASCADE clears every table (and anything referencing
      // them) in one statement — the Postgres equivalent of the old
      // "PRAGMA foreign_keys = OFF; DELETE FROM ..." sequence.
      await db.execute(sql`
        TRUNCATE TABLE
          activities, item_assignments, participants, transaction_items,
          transactions, settlements, group_members, groups, friendships, users
        CASCADE
      `);

      // Re-seed
      const { seed } = await import("@/lib/db/seed");
      await seed(db);

      return NextResponse.json({ success: true, message: "Database reset and re-seeded" });
    }

    if (action === "delete-all-transactions") {
      // Order matters with FKs enforced: clear referencing rows first, and
      // detach settlements that point at a transaction (they survive the
      // purge, matching the old behavior of only deleting transaction data).
      await db.execute(sql`DELETE FROM activities WHERE transaction_id IS NOT NULL`);
      await db.execute(sql`UPDATE settlements SET transaction_id = NULL WHERE transaction_id IS NOT NULL`);
      await db.execute(sql`DELETE FROM item_assignments`);
      await db.execute(sql`DELETE FROM participants`);
      await db.execute(sql`DELETE FROM transaction_items`);
      await db.execute(sql`DELETE FROM transactions`);

      return NextResponse.json({ success: true, message: "All transactions deleted" });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/debug error:", err);
    return NextResponse.json({
      success: false,
      error: mapErrorMessage(err),
    }, { status: 500 });
  }
}
