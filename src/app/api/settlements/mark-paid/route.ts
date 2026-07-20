import { NextRequest, NextResponse } from "next/server";
import { createAndMarkPaid } from "@/lib/actions/settlements";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";
import { settlementAmountValid } from "@/lib/security";

/**
 * POST /api/settlements/mark-paid
 * Create a settlement and mark it as paid.
 *
 * Body: { fromUserId: string, toUserId: string, amount: number, groupId?: string }
 * `groupId` scopes the payment to a group and records it in its activity feed.
 */
export async function POST(request: NextRequest) {
  try {
    const body: { fromUserId?: string; toUserId?: string; amount?: number; groupId?: string } =
      await request.json();

    if (!body.fromUserId || !body.toUserId) {
      return NextResponse.json<ApiErrorResponse>(
        apiError("Both fromUserId and toUserId are required.", CODES.MISSING_SETTLEMENT_ID),
        { status: 400 }
      );
    }

    // Reject non-positive, NaN, and Infinity amounts (Infinity > 0 is true,
    // so the old `amount <= 0` check let it slip into the ledger).
    if (!settlementAmountValid(body.amount)) {
      return NextResponse.json<ApiErrorResponse>(
        apiError("Settlement amount must be greater than 0.", CODES.INVALID_AMOUNT),
        { status: 400 }
      );
    }

    const settlement = await createAndMarkPaid(body.fromUserId, body.toUserId, body.amount, body.groupId);
    if (!settlement) {
      return NextResponse.json<ApiErrorResponse>(
        apiError("Could not create settlement record.", CODES.INTERNAL_ERROR),
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: settlement });
  } catch (err) {
    console.error("POST /api/settlements/mark-paid error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
