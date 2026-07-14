import { NextResponse } from "next/server";
import { runSimplifyTests } from "@/lib/test-data/run-simplify-tests";

/**
 * GET /api/debug/simplify-tests
 * Runs the debt-simplification test fixtures in-memory (no database access,
 * nothing persisted) and returns the per-case pass/fail results. Used by the
 * debug page's "Run simplification tests" button.
 */
export async function GET() {
  try {
    const results = runSimplifyTests();
    return NextResponse.json({ success: true, data: results });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
