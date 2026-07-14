import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { count, sql, eq } from "drizzle-orm";

/**
 * GET /api/debug
 * Returns DB statistics for debugging (no auth — dev-only).
 */
export async function GET() {
  try {
    const db = getDb();

    const userCount = db.select({ count: count() }).from(schema.users).get()?.count ?? 0;
    const txCount = db.select({ count: count() }).from(schema.transactions).get()?.count ?? 0;
    const itemCount = db.select({ count: count() }).from(schema.transactionItems).get()?.count ?? 0;
    const participantCount = db.select({ count: count() }).from(schema.participants).get()?.count ?? 0;
    const settlementCount = db.select({ count: count() }).from(schema.settlements).get()?.count ?? 0;
    const dbSize = sql`page_count * page_size`.as<number>();

    const users = db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).all();
    const transactions = db
      .select({
        id: schema.transactions.id,
        title: schema.transactions.title,
        totalAmount: schema.transactions.totalAmount,
        paidByUserId: schema.transactions.paidByUserId,
        createdAt: schema.transactions.createdAt,
      })
      .from(schema.transactions)
      .orderBy(sql`created_at DESC`)
      .all();

    // Check participants per transaction
    const participantsPerTx = transactions.map((tx) => {
      const result = db
        .select({ total: count() })
        .from(schema.participants)
        .where(eq(schema.participants.transactionId, tx.id))
        .get();
      return { txId: tx.id, participantCount: result?.total ?? 0 };
    });

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
      error: err instanceof Error ? err.message : "Unknown error",
    }, { status: 500 });
  }
}

/**
 * POST /api/debug?action=reset|delete-all-transactions
 */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    const db = getDb();

    if (action === "reset") {
      // Raw SQL to bypass any Drizzle query issues
      db.run("PRAGMA foreign_keys = OFF");
      db.run("DELETE FROM participants");
      db.run("DELETE FROM transaction_items");
      db.run("DELETE FROM transactions");
      db.run("DELETE FROM settlements");
      db.run("DELETE FROM friendships");
      db.run("DELETE FROM users");
      db.run("PRAGMA foreign_keys = ON");

      // Re-seed
      const { seed } = await import("@/lib/db/seed");
      seed(db);

      return NextResponse.json({ success: true, message: "Database reset and re-seeded" });
    }

    if (action === "delete-all-transactions") {
      db.run("PRAGMA foreign_keys = OFF");
      db.run("DELETE FROM participants");
      db.run("DELETE FROM transaction_items");
      db.run("DELETE FROM transactions");
      db.run("PRAGMA foreign_keys = ON");

      return NextResponse.json({ success: true, message: "All transactions deleted" });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/debug error:", err);
    return NextResponse.json({
      success: false,
      error: message,
    }, { status: 500 });
  }
}
