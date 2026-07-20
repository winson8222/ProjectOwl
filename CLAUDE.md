# ProjectOwl

Split receipts with friends — without the math. A Splitwise-like PWA built
with **Next.js 15**, **Tailwind v4**, and **PostgreSQL** (via Drizzle ORM).

Core flows: scan a receipt (photo → Gemini extracts items/prices → review →
assign items to friends → save) or enter a transaction manually (even or
custom % / $ split). Balances are always computed live from raw transaction
data (never stored), and the group's debts can be collapsed into the fewest
possible payments via the debt-simplification algorithm in
[`src/lib/simplify.ts`](src/lib/simplify.ts).

See [README.md](README.md) for full architecture, API routes, DB schema, and
project structure, and [ProjectOwl.md](ProjectOwl.md) for the product/UX flows.

## Always read Devlog.md first

**Before starting any work in this repo, read [Devlog.md](Devlog.md) in
full.** It's the running log of what's been built, why, and what broke —
architecture decisions, bug fixes, and the reasoning behind them live there,
not in the code comments. Treat it as required context, not optional
background.

When you finish a piece of work worth remembering (a feature, a nontrivial
fix, an architecture decision), add a dated entry to Devlog.md the same way
prior entries are written (`## YYYY-MM-DD — Title`, then `### Done` /
`### Fixed` / `### Architecture decisions` subsections).

## Running the app

```bash
npm run dev       # normal development server
npm run testmode  # dev server with debug UI + mock scan enabled (no LLM calls)
```

Both serve at [http://localhost:3000](http://localhost:3000).

- `npm run dev` — normal mode. Receipt scans call the real Gemini API
  (needs `GEMINI_API_KEY` in `.env.local`).
- `npm run testmode` — sets `NEXT_PUBLIC_DEBUG_UI=true` and
  `NEXT_PUBLIC_MOCK_SCAN=true`. Adds a "🐛 Mock scan" option on the New
  Transaction page that loads canned receipts from `MOCK_RECEIPTS` instead of
  calling `/api/receipts/extract` — use this to exercise the item-allocation
  flow without burning LLM quota. See
  [`src/lib/debug-config.ts`](src/lib/debug-config.ts).

The database is PostgreSQL (`projectowl` on `localhost:5432`, connection from
`DATABASE_URL` in `.env.local`). Schema changes go through drizzle-kit:
`npm run db:generate` writes a versioned migration into `drizzle/`, and
`npm run db:migrate` applies pending migrations. `npm run db:seed` inserts the
demo data (no-op if users exist; refuses to run when `NODE_ENV=production`).
None of this happens automatically at runtime — `getDb()` only opens a
connection.

Reset local data: `POST /api/debug?action=reset` while the server is running,
or `dropdb projectowl && createdb projectowl && npm run db:migrate && npm run db:seed`.

## Commit messages

**Keep commit messages detailed and only the info needed.**
Do not write any unneeded messages

## Test suites

```bash
npm run test:simplify    # debt-simplification algorithm (10 fixtures, in-memory)
npm run test:allocation  # receipt item-allocation logic (9 fixtures, in-memory)
```

Both are pure, in-memory, and touch nothing in the database. The settlement
suite (`npm run test:settlement`) runs against an in-memory PGlite
(Postgres-in-WASM) instance — also self-contained, no local Postgres needed.
Same suites are also runnable from the browser at `/debug` ("Run tests" under
each section), backed by `GET /api/debug/simplify-tests` and
`GET /api/debug/allocation-tests`.

See also [.claude/skills/dev-tools/SKILL.md](.claude/skills/dev-tools/SKILL.md)
for these plus other everyday dev commands (killing a stuck local server,
inspecting the DB, etc).
