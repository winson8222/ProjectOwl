import { NextRequest, NextResponse } from "next/server";
import { createTransaction, getTransactions, getTransaction, deleteTransaction } from "@/lib/actions/transactions";
import type { CreateTransactionInput } from "@/lib/actions/transactions";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * POST /api/transactions
 * Create a new transaction with (optional, descriptive) items and its
 * participant split.
 *
 * Validates required fields and split amounts before saving.
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateTransactionInput = await request.json();

    if (!body.title || !body.totalAmount || !body.paidByUserId || !body.transactionDate) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.TX_MISSING_FIELDS, CODES.MISSING_FIELDS),
        { status: 400 }
      );
    }

    if (!body.participants || body.participants.length === 0) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.TX_NO_PARTICIPANTS, CODES.NO_PARTICIPANTS),
        { status: 400 }
      );
    }

    // Validate: sum of participant shares must equal the transaction total
    const assignedTotal = body.participants.reduce((sum, p) => sum + p.shareAmount, 0);
    if (Math.abs(assignedTotal - body.totalAmount) > 0.01) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(
          ERROR_MESSAGES.TX_SPLIT_MISMATCH(assignedTotal.toFixed(2), body.totalAmount.toFixed(2)),
          CODES.SPLIT_MISMATCH
        ),
        { status: 400 }
      );
    }

    const transaction = createTransaction(body);
    return NextResponse.json({ success: true, data: transaction }, { status: 201 });
  } catch (err) {
    console.error("POST /api/transactions error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}

/**
 * GET /api/transactions
 * Query transactions, or get a single transaction by id.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const txId = searchParams.get("id");

    if (txId) {
      const userId = searchParams.get("userId") || undefined;
      const tx = getTransaction(txId, userId);
      if (!tx) {
        return NextResponse.json<ApiErrorResponse>(
          apiError(ERROR_MESSAGES.TX_NOT_FOUND, CODES.NOT_FOUND),
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: tx });
    }

    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.USER_ID_REQUIRED, CODES.MISSING_USER_ID),
        { status: 400 }
      );
    }

    const payer = searchParams.get("payer") || undefined;
    const payees = searchParams.get("payees")?.split(",").filter(Boolean) || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const transactions = getTransactions({ userId, payer, payees, limit });
    return NextResponse.json({ success: true, data: transactions });
  } catch (err) {
    console.error("GET /api/transactions error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/transactions?id=xxx  — delete a single transaction
 * DELETE /api/transactions?all=true — delete ALL transactions (reset data)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Delete ALL transactions
    if (searchParams.get("all") === "true") {
      const { getDb, schema } = await import("@/lib/db");
      const db = getDb();
      db.delete(schema.transactions).run();
      return NextResponse.json({ success: true, message: "All transactions deleted" });
    }

    // Delete a single transaction
    const txId = searchParams.get("id");
    if (!txId) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.TX_ID_REQUIRED, CODES.MISSING_ID),
        { status: 400 }
      );
    }

    const success = deleteTransaction(txId);
    if (!success) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.TX_NOT_FOUND, CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/transactions error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
