import { NextRequest, NextResponse } from "next/server";
import { createTransaction, getTransactions, getTransaction, deleteTransaction } from "@/lib/actions/transactions";
import type { CreateTransactionInput } from "@/lib/actions/transactions";

interface ApiError {
  success: false;
  error: string;
  code: string;
}

/**
 * POST /api/transactions
 * Create a new transaction with items and assignments.
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateTransactionInput = await request.json();

    if (!body.title || !body.totalAmount || !body.paidByUserId || !body.transactionDate) {
      return NextResponse.json<ApiError>(
        { success: false, error: "Missing required fields: title, totalAmount, paidByUserId, transactionDate", code: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json<ApiError>(
        { success: false, error: "Transaction must have at least one item", code: "NO_ITEMS" },
        { status: 400 }
      );
    }

    for (const item of body.items) {
      if (!item.assignments || item.assignments.length === 0) {
        return NextResponse.json<ApiError>(
          { success: false, error: `Item "${item.name}" has no assignments`, code: "UNASSIGNED_ITEM" },
          { status: 400 }
        );
      }
    }

    const transaction = createTransaction(body);
    return NextResponse.json({ success: true, data: transaction }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/transactions error:", err);
    return NextResponse.json<ApiError>(
      { success: false, error: message, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/transactions
 * Query transactions with filters, or get a single transaction by id.
 *
 * Query params for list:
 * - userId (required), payer (optional), payees (optional, comma-separated)
 *
 * Query params for single:
 * - id (transaction id), userId (for user's share computation)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const txId = searchParams.get("id");

    // Single transaction fetch
    if (txId) {
      const userId = searchParams.get("userId") || undefined;
      const tx = getTransaction(txId, userId);
      if (!tx) {
        return NextResponse.json<ApiError>(
          { success: false, error: "Transaction not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: tx });
    }

    // List fetch
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json<ApiError>(
        { success: false, error: "userId is required for list query", code: "MISSING_USER_ID" },
        { status: 400 }
      );
    }

    const payer = searchParams.get("payer") || undefined;
    const payees = searchParams.get("payees")?.split(",").filter(Boolean) || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const transactions = getTransactions({ userId, payer, payees, limit });
    return NextResponse.json({ success: true, data: transactions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("GET /api/transactions error:", err);
    return NextResponse.json<ApiError>(
      { success: false, error: message, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/transactions?id=xxx
 * Delete a transaction and all related data.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const txId = searchParams.get("id");

    if (!txId) {
      return NextResponse.json<ApiError>(
        { success: false, error: "Transaction id is required", code: "MISSING_ID" },
        { status: 400 }
      );
    }

    const success = deleteTransaction(txId);
    if (!success) {
      return NextResponse.json<ApiError>(
        { success: false, error: "Transaction not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("DELETE /api/transactions error:", err);
    return NextResponse.json<ApiError>(
      { success: false, error: message, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
