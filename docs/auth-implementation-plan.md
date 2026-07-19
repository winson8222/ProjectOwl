# Auth implementation plan — Supabase Auth (OAuth) on Render + Supabase Postgres

Goal: replace the current client-supplied `userId` identity (sessionStorage) with
**server-verified identity** so the group/authorization checks become real
boundaries instead of spoofable ones.

Stack: Next.js 15 app deployed on **Render**, Postgres + Auth on **Supabase**,
login via **OAuth (Google + GitHub)**. Data access stays on **Drizzle** (server
connection); authorization is enforced in the API layer using the verified user.

> **The one rule that makes this worth doing:** after this, no route may read
> `userId` / `actorId` / `creatorId` from the request body or query. Identity comes
> only from `getCurrentUser()`. If a route still trusts a body field, it's still
> exploitable.

Recommended sequencing: **Phase 1 → 2 → 3 → 4 → 5 → 6 → 7**, with Phase 8 (RLS) as
a later hardening pass. Phases 1–2 (Supabase + Postgres) are prerequisites for the
rest.

---

## Phase 1 — Provision Supabase + OAuth providers

- [ ] Create a Supabase project; note **Project URL**, **anon key**, **service-role
      key**, and the **Postgres connection string** (use the *pooled* connection for
      serverless-style hosting).
- [ ] **Google provider**: in Google Cloud Console create an OAuth 2.0 Web client.
      Authorized redirect URI = `https://<project-ref>.supabase.co/auth/v1/callback`.
      Paste client id/secret into Supabase → Authentication → Providers → Google.
- [ ] **GitHub provider**: create a GitHub OAuth App. Authorization callback URL =
      `https://<project-ref>.supabase.co/auth/v1/callback`. Paste client id/secret
      into Supabase → Providers → GitHub.
- [ ] Supabase → Authentication → URL Configuration:
      - **Site URL** = `https://<your-app>.onrender.com`
      - **Redirect allow-list** includes both
        `https://<your-app>.onrender.com/auth/callback` and
        `http://localhost:3000/auth/callback` (for local dev).

## Phase 2 — Migrate Drizzle SQLite → Supabase Postgres

- [ ] Swap the driver: `better-sqlite3` → `postgres` (or `pg`) +
      `drizzle-orm/postgres-js`. Update `getDb()` to connect via the Supabase
      connection string (`DATABASE_URL`).
- [ ] Port the schema to the Postgres dialect (`pgTable`, `text`/`uuid`/`numeric`/
      `boolean`/`timestamp`). Watch for:
      - money columns → `numeric(12,2)` (not float) to avoid rounding drift
      - the `settledAt = "PAID"` sentinel still works as `text`
      - `CURRENT_TIMESTAMP` / `localTimestamp()` → Postgres `now()` semantics
- [ ] **Add the auth-mapping column**: `users.auth_id uuid unique` (nullable).
      This links a Supabase auth identity to your app `users` row.
- [ ] Move from auto-migrate-on-startup to `drizzle-kit` migrations (generate + run
      against Supabase). Keep the seed for local/dev only.
- [ ] Re-point the three test suites — they're pure/in-memory, so they should be
      unaffected, but confirm `test:settlement` still runs against `getBalance`.

## Phase 3 — Auth wiring (`@supabase/ssr`)

- [ ] `npm i @supabase/supabase-js @supabase/ssr`.
- [ ] Server client factory that reads/writes the session cookie
      (`createServerClient` from `@supabase/ssr`, wired to `next/headers` cookies).
- [ ] **`src/lib/auth.ts` — `getCurrentUser()`** (server-only): calls
      `supabase.auth.getUser()` (verifies the JWT) and returns the auth user or null.
- [ ] **`resolveAppUser(authId)`**: fetch `users` by `auth_id`; if absent, create the
      app user row from the OAuth profile (name/email/avatar) and return it. Cache per
      request. This is the single boundary between "auth identity" and "app user".
- [ ] **OAuth callback route** `src/app/auth/callback/route.ts`: exchange the `?code`
      for a session (`exchangeCodeForSession`), set cookies, redirect to `/`.
- [ ] **`middleware.ts`**: refresh the session cookie on each request so tokens don't
      silently expire.

## Phase 4 — Refactor API routes off `userId` params (the actual fix)

For **every** route, replace self-asserted identity with the verified user:

```ts
const authUser = await getCurrentUser();
if (!authUser) return apiError(401, "Not signed in");
const me = await resolveAppUser(authUser.id);   // trustworthy app user id
// ...then use me.id; NEVER read userId/actorId from body/query
```

Route-by-route checklist (drop the param, use `me.id`, keep/enable the check):
- [ ] `GET/POST/DELETE /api/transactions` — `userId` param gone; group-ledger read
      requires `me.id` ∈ group; create uses `me.id` as the actor/creator.
- [ ] `GET /api/groups` — list groups for `me.id`.
- [ ] `GET /api/groups/[id]` — membership check on `me.id` (now real).
- [ ] `POST /api/groups` — creator = `me.id` (ignore any `creatorId`).
- [ ] `POST /api/groups/[id]/members` — actor = `me.id`, must be a member (now real).
- [ ] `GET /api/activities`, `GET /api/balances` — scope to `me.id`.
- [ ] `POST /api/settlements/mark-paid` — require `me.id` to be a party to (or a
      member of the group for) the settlement; ignore body-supplied payer identity.
- [ ] `GET /api/settlements/optimize`, `GET/POST /api/users` — same treatment; lock
      down who can create/list users.
- [ ] `POST /api/receipts/extract` — require a signed-in user (rate-limit target).
- [ ] Debug routes — already gated by `debugEndpointsEnabled()`; leave as-is.

## Phase 5 — Frontend login + remove sessionStorage identity

- [ ] Login screen with **"Continue with Google" / "Continue with GitHub"** buttons
      calling `supabase.auth.signInWithOAuth({ provider, options: { redirectTo:
      <site>/auth/callback } })`.
- [ ] Delete the sessionStorage user-picker; the current user comes from the session.
- [ ] Stop sending `userId`/`actorId` in fetch calls (the server ignores them now).
- [ ] Add sign-out (`supabase.auth.signOut()`) and a signed-out redirect guard.

## Phase 6 — Render deployment

- [ ] Set env vars in Render (Environment): `NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only),
      `DATABASE_URL`, `GEMINI_API_KEY`. **Never** expose the service-role key to the
      client bundle.
- [ ] Confirm `NODE_ENV=production` on Render → the debug endpoints stay 404 (from the
      earlier hardening). Leave `ALLOW_DEBUG_ENDPOINTS` unset.
- [ ] Verify the Render domain is in Supabase's Site URL + redirect allow-list.

## Phase 7 — Testing (do this as you go, not just at the end)

**Local full stack:** install the Supabase CLI, `supabase start` (local Postgres +
Auth in Docker), point the app at local Supabase. For OAuth locally you can either
configure real provider dev credentials or use email sign-in against the local Auth
server to obtain tokens.

1. **Regression-test the old exploits (most important):**
   - [ ] No session cookie → every protected route returns **401**.
   - [ ] Signed in as Alex, `GET /api/groups/<group-alex-is-not-in>` → **404**.
   - [ ] `POST /api/groups/[id]/members` while signed in as a non-member, body claiming
         a real member's `actorId` → **403** (body field ignored).
   - [ ] Any request with a *different* user's id injected in the body → response
         reflects the **session** user, not the injected id.
   - [ ] Confirm `POST /api/debug` / `?all=true` still blocked in a production build.
2. **Unit-test authz as pure functions** (`canReadGroup(userId, groupId)` etc.) — fits
   the existing in-memory suite; assert member→allow, non-member→deny, no-user→deny.
3. **Token-level curl checks:** obtain an access token, then
   `curl -H "Authorization: Bearer $TOKEN" .../api/groups/$ID` (200 as member) vs. no
   header (401). Confirms verification is independent of the browser.
4. **E2E (optional):** Playwright — log in through the OAuth button and drive one
   protected flow end-to-end.

Mindset: assert that **the previously-working attacks now fail**, and keep those as
regression tests.

## Phase 8 — Optional hardening (later)

- [ ] **RLS** on Supabase tables as a second, independent layer. Note: your Drizzle
      queries use a server connection, so RLS won't auto-apply to them — it protects
      against direct-to-Postgres access and is defense-in-depth, not a replacement for
      the Phase 4 checks.
- [ ] Rate-limit `POST /api/receipts/extract` (LLM cost) and the auth callback.
- [ ] Audit-log settlement + membership mutations with the verified actor id.

---

### Effort snapshot
- Phase 2 (Postgres migration) and Phase 4 (route refactor, ~10 routes) are the bulk.
- Phases 1, 3, 5, 6 are mostly configuration + a small amount of new code.
- The security payoff lands in Phase 4 — everything before it is setup.
