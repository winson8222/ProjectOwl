/**
 * Which auth mode is the app running in?
 *
 * - "mock"     — local dev: identity comes from the `mock_user_id` dev cookie,
 *                resolved against the seeded users table. No Supabase involved.
 * - "supabase" — staging/production: identity is a verified Supabase session
 *                (Google OAuth), mapped to an app user via `users.auth_id`.
 *
 * The mode is decided purely by env vars so the same code promotes unchanged
 * through master → staging → production: environments with Supabase env vars
 * activate real auth; local (.env.local sets NEXT_PUBLIC_AUTH_MODE=mock, no
 * Supabase vars) stays on the seeded-user picker.
 *
 * Safe to import from client components — it only reads NEXT_PUBLIC_ vars,
 * which Next.js inlines into the client bundle. The client's view of the mode
 * is cosmetic (which login UI to render); the authoritative check is always
 * server-side in getCurrentUser().
 */
export type AuthMode = "supabase" | "mock";

export function authMode(): AuthMode {
  if (process.env.NEXT_PUBLIC_AUTH_MODE === "mock") return "mock";
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return "supabase";
  return "mock"; // safe default for local dev
}
