import { NextResponse } from "next/server";
import { getGroupSettlementPlan } from "@/lib/actions/settlements";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * GET /api/settlements/optimize
 * Returns the group-wide minimum-transaction settlement plan
 * (fewest payments that settle everyone's balances).
 */
export async function GET() {
  try {
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
