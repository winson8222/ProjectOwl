import { NextRequest, NextResponse } from "next/server";
import { reorderGroupsForUser } from "@/lib/actions/groups";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized } from "@/lib/auth/guard";
import { CODES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * PUT /api/groups/reorder
 * Reorder the signed-in user's groups. Body: { groupIds: string[] } in the
 * desired display order. Identity comes from the session — any client-sent
 * userId is ignored.
 */
export async function PUT(request: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return unauthorized();

    const body: { groupIds?: string[] } = await request.json();

    if (!body.groupIds || !Array.isArray(body.groupIds)) {
      return NextResponse.json<ApiErrorResponse>(
        apiError("groupIds array is required", CODES.MISSING_FIELDS),
        { status: 400 }
      );
    }

    await reorderGroupsForUser(me.id, body.groupIds);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/groups/reorder error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
