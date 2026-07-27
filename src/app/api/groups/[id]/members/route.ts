import { NextRequest, NextResponse } from "next/server";
import { addGroupMembers, areGroupMembers, getGroupMemberIds } from "@/lib/actions/groups";
import { getUserByEmail } from "@/lib/actions/users";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized, forbidden } from "@/lib/auth/guard";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * POST /api/groups/[id]/members
 * Add users to a group. Body: { email: string } (exact-match lookup — the
 * only way to reference users you can't already see) or { userIds: string[] }
 * (internal/dev use). The signed-in user is the actor and must already be a
 * member; any client-sent actorId is ignored.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentUser();
    if (!me) return unauthorized();

    const { id } = await params;
    const body: { userIds?: string[]; email?: string } = await request.json();

    if (!(await areGroupMembers(id, [me.id]))) {
      return forbidden();
    }

    let userIds = body.userIds ?? [];
    if (body.email !== undefined) {
      const user = await getUserByEmail(body.email);
      if (!user) {
        return NextResponse.json<ApiErrorResponse>(
          apiError(ERROR_MESSAGES.EMAIL_NOT_FOUND, CODES.EMAIL_NOT_FOUND),
          { status: 404 }
        );
      }
      if ((await getGroupMemberIds(id)).includes(user.id)) {
        return NextResponse.json<ApiErrorResponse>(
          apiError(ERROR_MESSAGES.ALREADY_MEMBER, CODES.ALREADY_MEMBER),
          { status: 409 }
        );
      }
      userIds = [...userIds, user.id];
    }

    if (userIds.length === 0) {
      return NextResponse.json<ApiErrorResponse>(
        apiError("email or userIds is required", CODES.MISSING_FIELDS),
        { status: 400 }
      );
    }

    const members = await addGroupMembers(id, userIds, me.id);
    return NextResponse.json({ success: true, data: members });
  } catch (err) {
    console.error("POST /api/groups/[id]/members error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
