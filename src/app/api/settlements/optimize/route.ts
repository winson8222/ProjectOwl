import { NextRequest, NextResponse } from "next/server";
import { getGroupSettlementPlan } from "@/lib/actions/settlements";
import { getGroupTransferPlan, areGroupMembers } from "@/lib/actions/groups";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized, forbidden } from "@/lib/auth/guard";
import { CODES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * GET /api/settlements/optimize[?groupId=xxx]
 * Minimum-transaction settlement plan (fewest payments that settle everyone).
 * With `groupId`: scoped to that group — members only.
 * Without: legacy app-wide plan across all transactions (signed-in users).
 */
export async function GET(request: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return unauthorized();

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId");

    if (groupId) {
      if (!(await areGroupMembers(groupId, [me.id]))) {
        return forbidden();
      }
      const plan = (await getGroupTransferPlan(groupId)).map((t) => ({
        from: t.fromUser,
        to: t.toUser,
        amount: t.amount,
      }));
      return NextResponse.json({ success: true, data: plan });
    }

    const plan = await getGroupSettlementPlan();
    return NextResponse.json({ success: true, data: plan });
  } catch (err) {
    console.error("GET /api/settlements/optimize error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
