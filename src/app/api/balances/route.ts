import { NextRequest, NextResponse } from "next/server";
import { getBalance } from "@/lib/actions/balances";
import { CODES, ERROR_MESSAGES, apiError, type ApiErrorResponse } from "@/lib/constants";

/**
 * GET /api/balances?userId=xxx
 * Returns balance summary for a user.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.USER_ID_REQUIRED, CODES.MISSING_USER_ID),
        { status: 400 }
      );
    }

    const balance = getBalance(userId);
    return NextResponse.json({ success: true, data: balance });
  } catch (err) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.UNKNOWN;
    console.error("GET /api/balances error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(message, CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
