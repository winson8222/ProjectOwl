/**
 * Client-side session helpers.
 *
 * The server session (Supabase cookie or mock dev cookie) is the source of
 * truth — `fetchSessionUser()` resolves it via GET /api/auth/me and caches the
 * result in sessionStorage so pages can read it synchronously with
 * `getSessionUser()`. AppShell calls fetchSessionUser() before rendering any
 * page, so the cache is always warm by the time page components mount.
 *
 * The cached user is display data only. API routes never trust a client-sent
 * userId — identity is re-verified server-side on every request.
 */
import { authMode } from "@/lib/auth/mode";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

const CACHE_KEY = "projectowl_user";

/** Read the cached session user (synchronous; null when signed out). */
export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the server-verified session and refresh the cache.
 * Returns null when not signed in (cache is cleared).
 */
export async function fetchSessionUser(): Promise<SessionUser | null> {
  try {
    const res = await fetch("/api/auth/me");
    const json = await res.json();
    const user: SessionUser | null = json.success ? json.data : null;
    if (typeof window !== "undefined") {
      if (user) sessionStorage.setItem(CACHE_KEY, JSON.stringify(user));
      else sessionStorage.removeItem(CACHE_KEY);
    }
    return user;
  } catch {
    return getSessionUser(); // network hiccup — fall back to the cache
  }
}

/** Sign out of whichever session is active, then clear the cache. */
export async function signOut(): Promise<void> {
  if (authMode() === "supabase") {
    const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
    await createSupabaseBrowserClient().auth.signOut();
  } else {
    await fetch("/api/auth/session", { method: "DELETE" });
  }
  clearSession();
}

/** Clear the client-side cache (does not touch server cookies). */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CACHE_KEY);
}
