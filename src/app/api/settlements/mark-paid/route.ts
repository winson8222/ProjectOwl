import { NextRequest, NextResponse } from "next/server";
import { markSettled } from "@/lib/actions/settlements";

interface ApiError {
  success: false;
  error: string;
  code: string;
}

/**
 * POST /api/settlements/mark-paid
 * Mark a settlement as paid.
 *
 * Body: { settlementId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body: { settlementId?: string } = await request.json();

    if (!body.settlementId) {
      return NextResponse.json<ApiError>(
        { success: false, error: "settlementId is required", code: "MISSING_SETTLEMENT_ID" },
        { status: 400 }
      );
    }

    const success = markSettled(body.settlementId);
    if (!success) {
      return NextResponse.json<ApiError>(
        { success: false, error: "Settlement not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/settlements/mark-paid error:", err);
    return NextResponse.json<ApiError>(
      { success: false, error: message, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
