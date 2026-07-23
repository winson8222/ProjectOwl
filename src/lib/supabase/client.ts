"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client (login button, sign-out).
 * Only call in supabase auth mode — throws if the env vars are missing.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set — supabase auth mode requires them."
    );
  }
  return createBrowserClient(url, anonKey);
}
