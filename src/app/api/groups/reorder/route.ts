import { NextRequest, NextResponse } from "next/server";
import { reorderGroupsForUser } from "@/lib/actions/groups";
import { CODES, ERROR_MESSAGES, apiError, type ApiErrorResponse } from "@/lib/constants";

/**
 * PUT /api/groups/reorder
 * Reorder groups for a user. Body: { userId: string, groupIds: string[] }
 * groupIds should be in the desired display order.
 */
export async function PUT(request: NextRequest) {
  try {
    const body: { userId?: string; groupIds?: string[] } = await request.json();

    if (!body.userId) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.USER_ID_REQUIRED, CODES.MISSING_USER_ID),
        { status: 400 }
      );
    }

    if (!body.groupIds || !Array.isArray(body.groupIds)) {
      return NextResponse.json<ApiErrorResponse>(
        apiError("groupIds array is required", CODES.MISSING_FIELDS),
        { status: 400 }
      );
    }

    await reorderGroupsForUser(body.userId, body.groupIds);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/groups/reorder error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError((err as Error).message || "Failed to reorder groups", CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
