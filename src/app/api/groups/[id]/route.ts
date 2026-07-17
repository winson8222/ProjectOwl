import { NextRequest, NextResponse } from "next/server";
import { getGroupDetail, getGroupTransferPlan, getGroupDownBadRanking } from "@/lib/actions/groups";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * GET /api/groups/[id]?userId=xxx
 * Group detail: members, per-member net balances, pairwise nets vs. the
 * current user, the minimal settle-up transfer plan, and the "most down
 * bad" ranking.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.USER_ID_REQUIRED, CODES.MISSING_USER_ID),
        { status: 400 }
      );
    }

    const detail = getGroupDetail(id, userId);
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
        transferPlan: getGroupTransferPlan(id),
        downBadRanking: getGroupDownBadRanking(id),
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
