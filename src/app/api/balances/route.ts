import { NextRequest, NextResponse } from "next/server";
import { getBalance } from "@/lib/actions/balances";

/**
 * GET /api/balances?userId=xxx
 * Returns balance summary for a user.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required", code: "MISSING_USER_ID" },
        { status: 400 }
      );
    }

    const balance = getBalance(userId);
    return NextResponse.json({ success: true, data: balance });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("GET /api/balances error:", err);
    return NextResponse.json(
      { success: false, error: message, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
