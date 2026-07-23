import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { CODES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * GET /api/auth/me
 * The server-verified current user, or data: null when signed out.
 * (200 with null — not 401 — so the client shell can branch to the login
 * screen without treating it as an error.)
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({ success: true, data: user });
  } catch (err) {
    console.error("GET /api/auth/me error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
