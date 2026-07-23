import { NextRequest, NextResponse } from "next/server";
import { createTransaction, getTransactions, getTransaction, deleteTransaction } from "@/lib/actions/transactions";
import type { CreateTransactionInput } from "@/lib/actions/transactions";
import { areGroupMembers } from "@/lib/actions/groups";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized, forbidden } from "@/lib/auth/guard";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";
import { debugEndpointsEnabled } from "@/lib/debug-guard";
import { transactionAmountsValid, clampLimit } from "@/lib/security";

/**
 * POST /api/transactions
 * Create a new transaction with (optional, descriptive) items and its
 * participant split. The signed-in user must be a member of the group.
 *
 * Validates required fields and split amounts before saving.
 */
export async function POST(request: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return unauthorized();

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

    // A payment is a direct user→user transfer: exactly one recipient, not the payer.
    if (body.type === "payment") {
      if (body.participants.length !== 1) {
        return NextResponse.json<ApiErrorResponse>(
          apiError(ERROR_MESSAGES.PAYMENT_ONE_RECIPIENT, CODES.INVALID_PAYMENT),
          { status: 400 }
        );
      }
      if (body.participants[0].userId === body.paidByUserId) {
        return NextResponse.json<ApiErrorResponse>(
          apiError(ERROR_MESSAGES.PAYMENT_SELF, CODES.INVALID_PAYMENT),
          { status: 400 }
        );
      }
    }

    // Transactions must occur within a group…
    if (!body.groupId) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.GROUP_REQUIRED, CODES.MISSING_GROUP),
        { status: 400 }
      );
    }

    // …and everyone involved (payer + participants + the signed-in creator)
    // must be a group member. Identity is server-verified, so this check is a
    // real boundary now, not a spoofable one.
    const involved = [...new Set([me.id, body.paidByUserId, ...body.participants.map((p) => p.userId)])];
    if (!(await areGroupMembers(body.groupId, involved))) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.NOT_GROUP_MEMBER, CODES.NOT_GROUP_MEMBER),
        { status: 400 }
      );
    }

    // Validate: all money fields are real, finite, non-negative numbers.
    // Without this a negative total + negative shares still passes the
    // split-sum check below and silently corrupts everyone's balances.
    if (!transactionAmountsValid(body)) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.INVALID_AMOUNT, CODES.INVALID_AMOUNT),
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

    // Validate: ensure all items have non-empty names
    if (body.items && body.items.some(item => !item.name || item.name.trim() === '')) {
      return NextResponse.json<ApiErrorResponse>(
        apiError("All items must have non-empty names", CODES.MISSING_FIELDS),
        { status: 400 }
      );
    }

    const transaction = await createTransaction(body);
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
 * Query the signed-in user's transactions, or get a single transaction by id.
 * Identity comes from the session — any client-sent userId param is ignored.
 */
export async function GET(request: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return unauthorized();

    const { searchParams } = new URL(request.url);
    const txId = searchParams.get("id");

    if (txId) {
      const tx = await getTransaction(txId, me.id);
      // A transaction is visible only to members of its group. 404 (not 403)
      // so non-members can't probe which transaction ids exist.
      if (!tx || (tx.groupId && !(await areGroupMembers(tx.groupId, [me.id])))) {
        return NextResponse.json<ApiErrorResponse>(
          apiError(ERROR_MESSAGES.TX_NOT_FOUND, CODES.NOT_FOUND),
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: tx });
    }

    const payer = searchParams.get("payer") || undefined;
    const payees = searchParams.get("payees")?.split(",").filter(Boolean) || undefined;
    const groupId = searchParams.get("groupId") || undefined;

    // Reading a group's full ledger requires membership.
    if (groupId && !(await areGroupMembers(groupId, [me.id]))) {
      return forbidden();
    }

    // Clamp limit to a sane range so a huge/NaN value can't exhaust the server.
    const limit = clampLimit(searchParams.get("limit"));

    const transactions = await getTransactions({ userId: me.id, groupId, payer, payees, limit });
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

    // Delete ALL transactions — destructive reset tool, dev-only.
    if (searchParams.get("all") === "true") {
      if (!debugEndpointsEnabled()) {
        return NextResponse.json<ApiErrorResponse>(
          apiError(ERROR_MESSAGES.FORBIDDEN, CODES.FORBIDDEN),
          { status: 403 }
        );
      }
      const { getDb, schema } = await import("@/lib/db");
      const db = getDb();
      await db.delete(schema.transactions);
      return NextResponse.json({ success: true, message: "All transactions deleted" });
    }

    // Delete a single transaction — only group members may delete it.
    const me = await getCurrentUser();
    if (!me) return unauthorized();

    const txId = searchParams.get("id");
    if (!txId) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.TX_ID_REQUIRED, CODES.MISSING_ID),
        { status: 400 }
      );
    }

    const tx = await getTransaction(txId, me.id);
    if (!tx || (tx.groupId && !(await areGroupMembers(tx.groupId, [me.id])))) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.TX_NOT_FOUND, CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    const success = await deleteTransaction(txId);
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
