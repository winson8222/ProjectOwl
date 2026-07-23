import { NextRequest, NextResponse } from "next/server";
import { getGroupDetail, getGroupTransferPlan, getGroupDownBadRanking, areGroupMembers } from "@/lib/actions/groups";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized } from "@/lib/auth/guard";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * GET /api/groups/[id]
 * Group detail: members, per-member net balances, pairwise nets vs. the
 * signed-in user, the minimal settle-up transfer plan, and the "most down
 * bad" ranking. Members only — non-members get 404 (not 403) so group ids
 * can't be probed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentUser();
    if (!me) return unauthorized();

    const { id } = await params;

    if (!(await areGroupMembers(id, [me.id]))) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.GROUP_NOT_FOUND, CODES.GROUP_NOT_FOUND),
        { status: 404 }
      );
    }

    const detail = await getGroupDetail(id, me.id);
    if (!detail) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.GROUP_NOT_FOUND, CODES.GROUP_NOT_FOUND),
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...detail,
        transferPlan: await getGroupTransferPlan(id),
        downBadRanking: await getGroupDownBadRanking(id),
      },
    });
  } catch (err) {
    console.error("GET /api/groups/[id] error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
