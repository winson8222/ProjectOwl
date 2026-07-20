import { NextRequest, NextResponse } from "next/server";
import { getBalance } from "@/lib/actions/balances";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * GET /api/balances?userId=xxx[&groupId=yyy]
 * Returns balance summary for a user — overall, or scoped to one group.
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

    const groupId = searchParams.get("groupId") || undefined;
    const balance = await getBalance(userId, undefined, groupId);
    return NextResponse.json({ success: true, data: balance });
  } catch (err) {
    console.error("GET /api/balances error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
