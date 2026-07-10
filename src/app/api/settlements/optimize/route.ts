import { NextResponse } from "next/server";
import { getGroupSettlementPlan } from "@/lib/actions/settlements";
import { CODES, ERROR_MESSAGES, apiError, type ApiErrorResponse } from "@/lib/constants";

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
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.UNKNOWN;
    console.error("GET /api/settlements/optimize error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(message, CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
