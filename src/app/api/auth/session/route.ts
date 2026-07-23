import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { authMode } from "@/lib/auth/mode";
import { MOCK_SESSION_COOKIE } from "@/lib/auth";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * POST /api/auth/session — mock mode only. Body: { userId }.
 * Sets the httpOnly mock-identity cookie after verifying the user exists.
 * 404 in supabase mode: real sessions are established by the OAuth callback.
 */
export async function POST(request: NextRequest) {
  if (authMode() !== "mock") {
    return NextResponse.json<ApiErrorResponse>(
      apiError(ERROR_MESSAGES.UNKNOWN, CODES.NOT_FOUND),
      { status: 404 }
    );
  }

  try {
    const body: { userId?: string } = await request.json();
    if (!body.userId) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.USER_ID_REQUIRED, CODES.MISSING_USER_ID),
        { status: 400 }
      );
    }

    const user = (
      await getDb().select().from(schema.users).where(eq(schema.users.id, body.userId))
    )[0];
    if (!user) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.USER_NOT_FOUND, CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    const response = NextResponse.json({ success: true, data: user });
    response.cookies.set(MOCK_SESSION_COOKIE, user.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return response;
  } catch (err) {
    console.error("POST /api/auth/session error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/session — clear the mock-identity cookie (mock sign-out).
 * Supabase sign-out happens client-side via supabase.auth.signOut(); this
 * route is harmless there (the cookie just doesn't exist).
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(MOCK_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
