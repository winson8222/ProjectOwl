import { NextRequest, NextResponse } from "next/server";
import { getGroupPage } from "@/lib/actions/groups";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized } from "@/lib/auth/guard";
import { createTimer } from "@/lib/server-timing";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * GET /api/groups/[id]
 * Group detail: members, per-member net balances, pairwise nets vs. the
 * signed-in user, the minimal settle-up transfer plan, and the "most down
 * bad" ranking — all from one ledger fetch. Members only — non-members and
 * unknown ids both get 404 so group ids can't be probed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = createTimer();
  try {
    const me = await t.time("auth", () => getCurrentUser());
    if (!me) return unauthorized();

    const { id } = await params;
    // Passing `t` splits the db bucket into its parallel legs
    // (db.group / db.members / db.txs / db.settlements).
    const page = await t.time("db", () => getGroupPage(id, me.id, t));
    if (!page || !page.members.some((m) => m.id === me.id)) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.GROUP_NOT_FOUND, CODES.GROUP_NOT_FOUND),
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: page, _timing: t.toJSON() },
      { headers: t.headers() }
    );
  } catch (err) {
    console.error("GET /api/groups/[id] error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
