import { NextRequest, NextResponse } from "next/server";
import { addGroupMembers } from "@/lib/actions/groups";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * POST /api/groups/[id]/members
 * Add users to a group. Body: { userIds: string[], actorId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: { userIds?: string[]; actorId?: string } = await request.json();

    if (!body.userIds || body.userIds.length === 0 || !body.actorId) {
      return NextResponse.json<ApiErrorResponse>(
        apiError("userIds and actorId are required", CODES.MISSING_FIELDS),
        { status: 400 }
      );
    }

    const members = addGroupMembers(id, body.userIds, body.actorId);
    return NextResponse.json({ success: true, data: members });
  } catch (err) {
    console.error("POST /api/groups/[id]/members error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
