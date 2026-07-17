import { NextResponse } from "next/server";
import { runSettlementTests } from "@/lib/test-data/run-settlement-tests";

/**
 * GET /api/debug/settlement-tests
 * Runs the settlement-balance test fixtures against an in-memory SQLite database
 * and returns the per-case pass/fail results. Used by the debug page.
 */
export async function GET() {
  try {
    const results = runSettlementTests();
    return NextResponse.json({ success: true, data: results });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
