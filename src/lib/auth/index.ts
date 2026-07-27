import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { User } from "@supabase/supabase-js";
import { getDb, schema } from "@/lib/db";
import { authMode } from "./mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppUser = typeof schema.users.$inferSelect;

/** Name of the dev-only cookie that carries the mock identity. */
export const MOCK_SESSION_COOKIE = "mock_user_id";

/**
 * The single source of server-verified identity.
 *
 * - supabase mode: verifies the session JWT (`auth.getUser()` hits the auth
 *   server, it does not just decode the cookie) and maps it to an app user
 *   via users.auth_id, creating the row on first sign-in.
 * - mock mode: resolves the `mock_user_id` cookie against the seeded users
 *   table. No JWT — but routes are identical in both modes and never trust
 *   a request-supplied userId, so the production code path is what local
 *   development exercises.
 *
 * Returns null when not signed in. Routes must treat null as 401.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  if (authMode() === "supabase") return resolveViaSupabase();
  return resolveViaMockCookie();
}

async function resolveViaSupabase(): Promise<AppUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return resolveAppUser(user);
}

/**
 * The single boundary between "auth identity" and "app user".
 * Match by auth_id; else link an existing row by verified email (covers users
 * that predate auth); else create a fresh app user from the OAuth profile.
 */
async function resolveAppUser(authUser: User): Promise<AppUser | null> {
  const db = getDb();

  const byAuthId = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.authId, authUser.id));
  if (byAuthId[0]) return byAuthId[0];

  const email = authUser.email;
  if (email) {
    const linked = await db
      .update(schema.users)
      .set({ authId: authUser.id })
      .where(eq(schema.users.email, email))
      .returning();
    if (linked[0]) return linked[0];
  }

  if (!email) return null; // Google always supplies an email; refuse otherwise

  const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    email.split("@")[0];
  const avatarUrl =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;

  const created = await db
    .insert(schema.users)
    .values({ id: `user-${uuid().slice(0, 8)}`, name, email, avatarUrl, authId: authUser.id })
    .returning();
  return created[0] ?? null;
}

async function resolveViaMockCookie(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(MOCK_SESSION_COOKIE)?.value;
  if (!userId) return null;

  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  return rows[0] ?? null;
}
