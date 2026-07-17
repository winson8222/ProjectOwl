import { NextRequest, NextResponse } from "next/server";
import { getActivitiesForUser } from "@/lib/actions/activities";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * GET /api/activities?userId=xxx&limit=50
 * Activity feed across every group the user belongs to, newest first.
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

    const limit = parseInt(searchParams.get("limit") || "50", 10);
    return NextResponse.json({ success: true, data: getActivitiesForUser(userId, limit) });
  } catch (err) {
    console.error("GET /api/activities error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
