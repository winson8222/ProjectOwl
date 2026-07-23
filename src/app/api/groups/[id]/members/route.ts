import { NextRequest, NextResponse } from "next/server";
import { addGroupMembers, areGroupMembers } from "@/lib/actions/groups";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized, forbidden } from "@/lib/auth/guard";
import { CODES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * POST /api/groups/[id]/members
 * Add users to a group. Body: { userIds: string[] }.
 * The signed-in user is the actor and must already be a member; any
 * client-sent actorId is ignored.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentUser();
    if (!me) return unauthorized();

    const { id } = await params;
    const body: { userIds?: string[] } = await request.json();

    if (!body.userIds || body.userIds.length === 0) {
      return NextResponse.json<ApiErrorResponse>(
        apiError("userIds is required", CODES.MISSING_FIELDS),
        { status: 400 }
      );
    }

    if (!(await areGroupMembers(id, [me.id]))) {
      return forbidden();
    }

    const members = await addGroupMembers(id, body.userIds, me.id);
    return NextResponse.json({ success: true, data: members });
  } catch (err) {
    console.error("POST /api/groups/[id]/members error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
