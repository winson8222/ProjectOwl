import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase session refresh (supabase auth mode only).
 * Server Components can't write cookies, so expiring auth tokens must be
 * refreshed here on each request. In mock mode this is a pass-through.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const mockMode = process.env.NEXT_PUBLIC_AUTH_MODE === "mock" || !url || !anonKey;
  if (mockMode) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Triggers a token refresh when the access token is stale, and writes the
  // refreshed cookies onto the response.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Skip static assets AND /api: API routes verify the session themselves in
  // getCurrentUser() (and can write refreshed cookies from route handlers),
  // so running the middleware there doubled the auth-server round trip on
  // every request for no benefit. Pages still get cookie refresh here.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
