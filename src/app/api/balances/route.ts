import { NextRequest, NextResponse } from "next/server";
import { getBalance } from "@/lib/actions/balances";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized } from "@/lib/auth/guard";
import { CODES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * GET /api/balances[?groupId=yyy]
 * Balance summary for the signed-in user — overall, or scoped to one group.
 * Identity comes from the session — any client-sent userId param is ignored.
 */
export async function GET(request: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return unauthorized();

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId") || undefined;
    const balance = await getBalance(me.id, undefined, groupId);
    return NextResponse.json({ success: true, data: balance });
  } catch (err) {
    console.error("GET /api/balances error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
