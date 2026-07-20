import { NextRequest, NextResponse } from "next/server";
import { getGroupsForUser, createGroup } from "@/lib/actions/groups";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * GET /api/groups?userId=xxx
 * List the groups a user belongs to, with members and the user's net position.
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

    return NextResponse.json({ success: true, data: await getGroupsForUser(userId) });
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
 * Create a group. Body: { name, creatorId, memberIds?, color? }
 * The creator is always added as a member.
 */
export async function POST(request: NextRequest) {
  try {
    const body: { name?: string; creatorId?: string; memberIds?: string[]; color?: string } =
      await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.GROUP_NAME_REQUIRED, CODES.MISSING_FIELDS),
        { status: 400 }
      );
    }
    if (!body.creatorId) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.USER_ID_REQUIRED, CODES.MISSING_USER_ID),
        { status: 400 }
      );
    }

    const group = await createGroup(body.name.trim(), body.creatorId, body.memberIds ?? [], body.color);
    return NextResponse.json({ success: true, data: group }, { status: 201 });
  } catch (err) {
    console.error("POST /api/groups error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
