import { NextRequest, NextResponse } from "next/server";
import { getGroupSettlementPlan } from "@/lib/actions/settlements";
import { getGroupTransferPlan } from "@/lib/actions/groups";
import { CODES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * GET /api/settlements/optimize[?groupId=xxx]
 * Minimum-transaction settlement plan (fewest payments that settle everyone).
 * With `groupId`: scoped to that group's members, transactions, and payments.
 * Without: legacy app-wide plan across all transactions.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId");

    if (groupId) {
      const plan = getGroupTransferPlan(groupId).map((t) => ({
        from: t.fromUser,
        to: t.toUser,
        amount: t.amount,
      }));
      return NextResponse.json({ success: true, data: plan });
    }

    const plan = getGroupSettlementPlan();
    return NextResponse.json({ success: true, data: plan });
  } catch (err) {
    console.error("GET /api/settlements/optimize error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
