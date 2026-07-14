import { NextRequest, NextResponse } from "next/server";
import { markSettled } from "@/lib/actions/settlements";
import { CODES, ERROR_MESSAGES, apiError, type ApiErrorResponse } from "@/lib/constants";

/**
 * POST /api/settlements/mark-paid
 * Mark a settlement as paid.
 *
 * Body: { settlementId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body: { settlementId?: string } = await request.json();

    if (!body.settlementId) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.SETTLEMENT_ID_REQUIRED, CODES.MISSING_SETTLEMENT_ID),
        { status: 400 }
      );
    }

    const success = markSettled(body.settlementId);
    if (!success) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.SETTLEMENT_NOT_FOUND, CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.UNKNOWN;
    console.error("POST /api/settlements/mark-paid error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(message, CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
