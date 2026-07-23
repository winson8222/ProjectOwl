import { NextRequest, NextResponse } from "next/server";
import { getUsers, getUser, createUser } from "@/lib/actions/users";
import { getCurrentUser } from "@/lib/auth";
import { authMode } from "@/lib/auth/mode";
import { unauthorized, forbidden } from "@/lib/auth/guard";
import { CODES, ERROR_MESSAGES, apiError, mapErrorMessage, type ApiErrorResponse } from "@/lib/constants";

/**
 * GET /api/users
 * Returns all users. Query: ?id=xxx to get a single user.
 * Supabase mode: signed-in users only. Mock mode: open — the pre-login
 * seeded-user picker needs this list (local dev only by construction).
 */
export async function GET(request: NextRequest) {
  try {
    if (authMode() === "supabase" && !(await getCurrentUser())) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const user = await getUser(id);
      if (!user) {
        return NextResponse.json<ApiErrorResponse>(
          apiError(ERROR_MESSAGES.USER_NOT_FOUND, CODES.NOT_FOUND),
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: user });
    }

    const users = await getUsers();
    return NextResponse.json({ success: true, data: users });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}

/**
 * POST /api/users
 * Create a new test user — mock mode only. In supabase mode app users are
 * created by the OAuth sign-in flow (resolveAppUser), never via this route.
 * Body: { name: string, email: string }
 */
export async function POST(request: NextRequest) {
  try {
    if (authMode() !== "mock") {
      return forbidden();
    }

    const body = await request.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json<ApiErrorResponse>(
        apiError(ERROR_MESSAGES.NAME_EMAIL_REQUIRED, CODES.MISSING_NAME_EMAIL),
        { status: 400 }
      );
    }

    const user = await createUser(name, email);
    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (err) {
    console.error("POST /api/users error:", err);
    return NextResponse.json<ApiErrorResponse>(
      apiError(mapErrorMessage(err), CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
