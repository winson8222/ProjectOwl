import { NextRequest, NextResponse } from "next/server";
import { getGroupsForUser, createGroup } from "@/lib/actions/groups";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized } from "@/lib/auth/guard";
import { createTimer } from "@/lib/server-timing";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * GET /api/groups
 * List the signed-in user's groups, with members and their net position.
 * Identity comes from the session — any client-sent userId param is ignored.
 */
export async function GET() {
  const t = createTimer();
  try {
    const me = await t.time("auth", () => getCurrentUser());
    if (!me) return unauthorized();

    const groups = await t.time("db", () => getGroupsForUser(me.id));
    return NextResponse.json(
      { success: true, data: groups, _timing: t.toJSON() },
      { headers: t.headers() }
    );
  } catch (err) {
    console.error("GET /api/groups error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}

/**
 * POST /api/groups
 * Create a group. Body: { name, memberIds?, color? }
 * The signed-in user is the creator and always a member; any client-sent
 * creatorId is ignored.
 */
export async function POST(request: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return unauthorized();

    const body: { name?: string; memberIds?: string[]; color?: string } = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.GROUP_NAME_REQUIRED, CODES.MISSING_FIELDS),
        { status: 400 }
      );
    }

    const group = await createGroup(body.name.trim(), me.id, body.memberIds ?? [], body.color);
    return NextResponse.json({ success: true, data: group }, { status: 201 });
  } catch (err) {
    console.error("POST /api/groups error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
