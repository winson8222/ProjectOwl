import { NextRequest, NextResponse } from "next/server";
import { authMode } from "@/lib/auth/mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback?code=...
 * OAuth landing: exchange the authorization code for a Supabase session
 * (sets the auth cookies), then send the user into the app.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  if (authMode() !== "supabase") {
    return NextResponse.redirect(origin);
  }

  const code = searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(origin);
    console.error("OAuth callback exchange failed:", error.message);
  }

  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
