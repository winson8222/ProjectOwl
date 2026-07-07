import { NextRequest, NextResponse } from "next/server";
import { getUsers, getUser } from "@/lib/actions/users";

interface ApiError {
  success: false;
  error: string;
  code: string;
}

/**
 * GET /api/users
 * Returns all seed users (prototype: no real auth).
 * Query: ?id=xxx to get a single user.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const user = getUser(id);
      if (!user) {
        return NextResponse.json<ApiError>(
          { success: false, error: "User not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: user });
    }

    const users = getUsers();
    return NextResponse.json({ success: true, data: users });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("GET /api/users error:", err);
    return NextResponse.json<ApiError>(
      { success: false, error: message, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
