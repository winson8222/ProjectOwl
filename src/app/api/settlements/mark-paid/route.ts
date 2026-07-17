import { NextRequest, NextResponse } from "next/server";
import { createAndMarkPaid } from "@/lib/actions/settlements";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * POST /api/settlements/mark-paid
 * Create a settlement and mark it as paid.
 *
 * Body: { fromUserId: string, toUserId: string, amount: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body: { fromUserId?: string; toUserId?: string; amount?: number } =
      await request.json();

    if (!body.fromUserId || !body.toUserId) {
      return NextResponse.json<ApiErrorResponse>(
        apiError("Both fromUserId and toUserId are required.", CODES.MISSING_SETTLEMENT_ID),
        { status: 400 }
      );
    }

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json<ApiErrorResponse>(
        apiError("Settlement amount must be greater than 0.", CODES.MISSING_SETTLEMENT_ID),
        { status: 400 }
      );
    }

    const settlement = createAndMarkPaid(body.fromUserId, body.toUserId, body.amount);
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
