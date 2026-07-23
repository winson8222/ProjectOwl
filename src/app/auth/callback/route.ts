import { NextRequest, NextResponse } from "next/server";
import { authMode } from "@/lib/auth/mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback?code=...&next=/join/abc
 * OAuth landing: exchange the authorization code for a Supabase session
 * (sets the auth cookies), then send the user into the app. `next` must be
 * a same-origin path ("/..." but not "//...") or it falls back to "/" —
 * used so invite links survive the sign-in round-trip.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (authMode() !== "supabase") {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const code = searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("OAuth callback exchange failed:", error.message);
  }

  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
