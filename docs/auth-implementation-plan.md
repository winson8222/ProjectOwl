# Auth implementation plan — dual-mode Supabase Auth (Google OAuth)

> **Status (2026-07-23): implemented.** All code phases (2–5, plus the deploy
> migrate step of 6) are done — see the Devlog entry of the same date for what
> shipped and the smoke-test results. What remains is the **manual console
> work**: Phase 1 (create the two Supabase projects + Google OAuth clients) and
> the Phase 6 env-var setup in the Vercel dashboard. Local dev needs nothing —
> with no Supabase env vars present the app runs in mock mode automatically
> (optionally set `NEXT_PUBLIC_AUTH_MODE=mock` in `.env.local` to be explicit).

Goal: replace the current client-supplied `userId` identity (sessionStorage) with
**server-verified identity** so the group/authorization checks become real
boundaries instead of spoofable ones — **without** losing the frictionless
seeded-user workflow we rely on for local development.

Two runtime modes, one codebase:

| Mode | Where | Identity source | Login UI |
|---|---|---|---|
| **mock** | local dev | a `mock_user_id` dev cookie, resolved to a **seeded** `users` row | seeded-user picker |
| **supabase** | staging + production | verified Supabase session (Google OAuth), resolved to a `users` row via `auth_id` | "Continue with Google" |

Stack: Next.js 15 on **Vercel**, Postgres + Auth on **Supabase**, login via
**Google OAuth**. Data access stays on **Drizzle** (server connection);
authorization is enforced in the API layer using the verified user.

> **The one rule that makes this worth doing:** after this, no route may read
> `userId` / `actorId` / `creatorId` from the request body or query. Identity comes
> only from `getCurrentUser()`. If a route still trusts a body field, it's still
> exploitable — **in both modes**. The mock path uses a cookie precisely so the
> route code is identical to production and the spoofing fix is exercised locally.

---

## The core idea: behavior is switched by env vars, not by branching code

The promotion flow (`master → staging → production`) ships **identical code** to
every environment. The Supabase integration is therefore written as *dormant code
gated on environment variables*:

- Locally, the Supabase env vars are absent and `NEXT_PUBLIC_AUTH_MODE=mock`, so
  the app runs the seeded-user picker and never talks to Supabase.
- On staging/production, the Supabase env vars are set (per-environment, in the
  Vercel dashboard), so the same code activates real auth.

Nothing about auth mode lives in the code that gets promoted — so promoting
`master → staging → production` carries the full auth implementation into every
environment with **zero per-branch edits** and nothing to remember to "turn on".

### Env var matrix

| Variable | Local (`.env.local`) | Staging (Vercel Preview scope) | Production (Vercel Production scope) |
|---|---|---|---|
| `NEXT_PUBLIC_AUTH_MODE` | `mock` | *(unset → supabase)* | *(unset → supabase)* |
| `NEXT_PUBLIC_SUPABASE_URL` | absent | staging project URL | prod project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | absent | staging anon key | prod anon key |
| `SUPABASE_SERVICE_ROLE_KEY` (server-only) | absent | staging service-role key | prod service-role key |
| `DATABASE_URL` | local Postgres | staging Supabase (pooled) | prod Supabase (pooled) |
| `DIRECT_URL` (migrations) | local Postgres | staging Supabase (direct) | prod Supabase (direct) |
| `GEMINI_API_KEY` | your key | your key | your key |
| Users come from | `npm run db:seed` | first Google sign-in | first Google sign-in |

Notes:
- `NEXT_PUBLIC_AUTH_MODE` **must** be `NEXT_PUBLIC_` because the login screen (client)
  reads it to decide picker-vs-OAuth. The *authoritative* identity check is still
  server-side in `getCurrentUser()`, so a spoofed client flag buys an attacker
  nothing on staging/prod — the server verifies the JWT regardless.
- In Vercel, set staging's variables on the **Preview** scope restricted to the
  `staging` branch, so staging points at its own Supabase project distinct from
  production. Production's variables go on the **Production** scope.
- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the client bundle (no
  `NEXT_PUBLIC_` prefix).

---

## Prerequisites already done (per Devlog)

- ✅ **Postgres migration** — schema is `pg-core`, driver is `postgres.js` with
  `prepare:false` (pooler-compatible), `getDb()` is connection-only, migrations are
  versioned drizzle-kit files (`npm run db:migrate`), seed is explicit
  (`npm run db:seed`) and **refuses to run in production**.
- ✅ **Debug endpoint lockdown + input validation** — debug routes gate on the
  server-only `debugEndpointsEnabled()`; money/limit validation is in place.
- ⏭️ **Per-group authorization was deliberately deferred to this work** — it can only
  be a real boundary once identity is server-verified (Phase 4 below).

So Phase 2 is now just the small **auth-mapping column**, not a driver swap.

---

## Phase 1 — Provision Supabase + Google OAuth (staging and production)

Do this **twice** — once per Supabase project (staging, production) — so the two
environments have fully separate data and auth.

- [ ] Create the Supabase project; note **Project URL**, **anon key**,
      **service-role key**, and both the **pooled** (`DATABASE_URL`, port 6543) and
      **direct** (`DIRECT_URL`, port 5432) Postgres connection strings.
- [ ] **Google provider**: in Google Cloud Console create an OAuth 2.0 Web client.
      Authorized redirect URI = `https://<project-ref>.supabase.co/auth/v1/callback`.
      Paste client id/secret into Supabase → Authentication → Providers → Google.
- [ ] Supabase → Authentication → URL Configuration:
      - **Site URL** = the environment's Vercel URL (staging vs production domain).
      - **Redirect allow-list** includes that environment's
        `https://<domain>/auth/callback`, and — on the local-testing project only —
        `http://localhost:3000/auth/callback`.

## Phase 2 — Add the auth-mapping column

- [ ] Add `users.auth_id uuid unique` (**nullable**) to `schema.ts`. This links a
      Supabase auth identity to an app `users` row. Nullable so the seeded users
      (mock mode) and any legacy rows remain valid.
- [ ] `npm run db:generate` → review the migration → `npm run db:migrate` against
      each Supabase project (and locally).
- [ ] The three pure/in-memory test suites are unaffected; confirm
      `test:settlement` still runs against `getBalance`.

## Phase 3 — Auth wiring (`@supabase/ssr`) + the mode switch

- [ ] `npm i @supabase/supabase-js @supabase/ssr`.
- [ ] **`src/lib/auth/mode.ts`** — the single source of truth for which mode is active:

      ```ts
      export function authMode(): "supabase" | "mock" {
        if (process.env.NEXT_PUBLIC_AUTH_MODE === "mock") return "mock";
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) return "supabase";
        return "mock"; // safe default for local
      }
      ```

- [ ] **`src/lib/auth/index.ts` — `getCurrentUser()`** (server-only) branches on
      `authMode()`:

      ```ts
      export async function getCurrentUser(): Promise<AppUser | null> {
        if (authMode() === "supabase") return resolveViaSupabase();
        return resolveViaMockCookie();
      }
      ```

  - **`resolveViaSupabase()`** — `createServerClient` (`@supabase/ssr`, wired to
    `next/headers` cookies) → `supabase.auth.getUser()` (verifies the JWT) →
    `resolveAppUser(authUser)`.
  - **`resolveAppUser(authUser)`** — fetch `users` by `auth_id`; if absent, create the
    app-user row from the Google profile (name/email/avatar) and return it. Cache per
    request. This is the **single** boundary between "auth identity" and "app user".
  - **`resolveViaMockCookie()`** — read the `mock_user_id` cookie, look up that seeded
    `users` row, return it (or null). No JWT, no Supabase call. This keeps route code
    identical across modes while never trusting a request-body `userId`.

- [ ] **OAuth callback route** `src/app/auth/callback/route.ts` (supabase mode):
      exchange `?code` for a session (`exchangeCodeForSession`), set cookies, redirect
      to `/`.
- [ ] **`middleware.ts`**: refresh the Supabase session cookie on each request so
      tokens don't silently expire. No-op in mock mode.

## Phase 4 — Refactor API routes off `userId` params (the actual fix)

For **every** route, replace self-asserted identity with the verified user — this
code is identical in both modes because `getCurrentUser()` abstracts the source:

```ts
const me = await getCurrentUser();
if (!me) return apiError(401, "Not signed in");
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
      down who can create/list users. (In mock mode the picker still needs
      `GET /api/users` to list seeded users — keep that readable, but gate writes.)
- [ ] `POST /api/receipts/extract` — require a signed-in user (rate-limit target).
- [ ] Debug routes — already gated by `debugEndpointsEnabled()`; leave as-is.

## Phase 5 — Frontend login (picker-or-OAuth) + remove sessionStorage identity

- [ ] Login screen reads `NEXT_PUBLIC_AUTH_MODE` (via `authMode()`):
      - **supabase** → a single **"Continue with Google"** button calling
        `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo:
        <site>/auth/callback } })`.
      - **mock** → the existing seeded-user picker, but instead of writing to
        `sessionStorage`, it sets the `mock_user_id` cookie (a tiny
        `POST /api/dev/session` or a client-set cookie) and reloads.
- [ ] Delete the `sessionStorage` user identity (`src/lib/session.ts` picker path);
      the current user always comes from `getCurrentUser()` server-side now.
- [ ] Stop sending `userId`/`actorId` in fetch calls (the server ignores them).
- [ ] Add sign-out (supabase: `supabase.auth.signOut()`; mock: clear the cookie) and a
      signed-out redirect guard.

## Phase 6 — Vercel deployment + promotion-flow wiring

- [ ] Set env vars in Vercel per the matrix above, scoped by environment:
      - **Production** scope: production Supabase keys + `DATABASE_URL`/`DIRECT_URL`.
      - **Preview** scope restricted to the `staging` branch: staging Supabase keys.
      - Leave `NEXT_PUBLIC_AUTH_MODE` **unset** in both (so they default to supabase);
        set it to `mock` only in your local `.env.local`.
- [ ] `NODE_ENV=production` on Vercel keeps debug endpoints 404 and `db:seed` refusing
      to run — so staging/prod never get seeded demo users. Leave
      `ALLOW_DEBUG_ENDPOINTS` unset.
- [ ] Verify each environment's Vercel domain is in the matching Supabase project's
      Site URL + redirect allow-list.
- [ ] **Migrations across the promotion flow:** the promoted code includes the
      `auth_id` migration file, but migrations don't run at runtime (`getDb()` is
      connection-only). Run `npm run db:migrate` against staging when promoting to
      staging, and against production when promoting to production — as a manual step
      or a deploy hook. (Consider adding a `vercel-build`/deploy step that runs
      `db:migrate` using `DIRECT_URL`.)

## Phase 7 — Testing (do this as you go, not just at the end)

**Local:** runs in mock mode — verify the picker still works and that routes read the
cookie, not request params. Then, to exercise supabase mode locally, either install
the Supabase CLI (`supabase start`) and point `.env.local` at it with
`NEXT_PUBLIC_AUTH_MODE` unset, or temporarily point at the staging project.

1. **Regression-test the old exploits (most important):**
   - [ ] Mock mode: a request with a *different* user's id in the body → response
         reflects the **cookie** user, not the injected id (proves the param is dead).
   - [ ] Supabase mode, no session cookie → every protected route returns **401**.
   - [ ] Signed in as Alex, `GET /api/groups/<group-alex-is-not-in>` → **404**.
   - [ ] `POST /api/groups/[id]/members` as a non-member with a body claiming a real
         member's `actorId` → **403** (body field ignored).
   - [ ] Confirm `POST /api/debug` / `?all=true` still blocked in a production build.
2. **Unit-test authz as pure functions** (`canReadGroup(userId, groupId)` etc.) — fits
   the existing in-memory suite; assert member→allow, non-member→deny, no-user→deny.
   Mode-independent, so one suite covers both.
3. **Token-level curl checks (supabase):** obtain an access token, then
   `curl -H "Authorization: Bearer $TOKEN" .../api/groups/$ID` (200 as member) vs. no
   header (401).

Mindset: assert that **the previously-working attacks now fail**, and keep those as
regression tests.

## Phase 8 — Optional hardening (later)

- [ ] **RLS** on Supabase tables as a second, independent layer. Note: Drizzle uses a
      server connection, so RLS won't auto-apply to those queries — it protects against
      direct-to-Postgres access and is defense-in-depth, not a replacement for Phase 4.
- [ ] Rate-limit `POST /api/receipts/extract` (LLM cost) and the auth callback.
- [ ] Audit-log settlement + membership mutations with the verified actor id.
- [ ] Add GitHub / email-magic-link providers if the audience grows (same
      `signInWithOAuth` shape; add the button + the Supabase provider config).

---

### Effort snapshot
- Phase 4 (route refactor, ~10 routes) is the bulk and where the security payoff lands.
- Phase 3 (the mode switch + two resolvers) is the new dual-mode machinery — small.
- Phases 1, 5, 6 are mostly configuration.
- Because behavior is env-gated, **nothing here requires per-branch code**; the same
  commit is correct on local, staging, and production.
