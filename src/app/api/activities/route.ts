import { NextRequest, NextResponse } from "next/server";
import { getActivitiesForUser } from "@/lib/actions/activities";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized } from "@/lib/auth/guard";
import { CODES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * GET /api/activities?limit=50
 * Activity feed across every group the signed-in user belongs to, newest
 * first. Identity comes from the session — any userId param is ignored.
 */
export async function GET(request: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return unauthorized();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    return NextResponse.json({ success: true, data: await getActivitiesForUser(me.id, limit) });
  } catch (err) {
    console.error("GET /api/activities error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
