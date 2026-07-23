import { NextRequest, NextResponse } from "next/server";
import { areGroupMembers } from "@/lib/actions/groups";
import { createGroupInvite } from "@/lib/actions/invites";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized, forbidden } from "@/lib/auth/guard";
import { CODES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * POST /api/groups/[id]/invites
 * Get a shareable invite link for the group (members only). Reuses the
 * newest still-valid token, so this is safe to call on every "copy link".
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentUser();
    if (!me) return unauthorized();

    const { id } = await params;
    if (!(await areGroupMembers(id, [me.id]))) {
      return forbidden();
    }

    const invite = await createGroupInvite(id, me.id);
    return NextResponse.json({
      success: true,
      data: { token: invite.token, path: `/join/${invite.token}`, expiresAt: invite.expiresAt },
    });
  } catch (err) {
    console.error("POST /api/groups/[id]/invites error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
