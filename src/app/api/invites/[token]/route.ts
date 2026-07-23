import { NextRequest, NextResponse } from "next/server";
import { getInvitePreview, acceptGroupInvite } from "@/lib/actions/invites";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized } from "@/lib/auth/guard";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * GET /api/invites/[token]
 * Preview an invite for the /join page: group name, inviter, member count.
 * Signed-in only; 404 for unknown/expired tokens.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const me = await getCurrentUser();
    if (!me) return unauthorized();

    const { token } = await params;
    const preview = await getInvitePreview(token, me.id);
    if (!preview) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.INVITE_INVALID, CODES.INVITE_INVALID),
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: preview });
  } catch (err) {
    console.error("GET /api/invites/[token] error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}

/**
 * POST /api/invites/[token]
 * Join the invite's group as the signed-in user. Idempotent for existing
 * members. Returns { groupId } to redirect to.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const me = await getCurrentUser();
    if (!me) return unauthorized();

    const { token } = await params;
    const groupId = await acceptGroupInvite(token, me);
    if (!groupId) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.INVITE_INVALID, CODES.INVITE_INVALID),
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: { groupId } });
  } catch (err) {
    console.error("POST /api/invites/[token] error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
