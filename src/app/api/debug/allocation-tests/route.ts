import { NextResponse } from "next/server";
import { runAllocationTests } from "@/lib/test-data/run-allocation-tests";

/**
 * GET /api/debug/allocation-tests
 * Runs the receipt-allocation test fixtures in-memory (no database access,
 * no LLM, nothing persisted) and returns the per-case pass/fail results.
 * Used by the debug page's "Run allocation tests" button.
 */
export async function GET() {
  try {
    const results = runAllocationTests();
    return NextResponse.json({ success: true, data: results });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
