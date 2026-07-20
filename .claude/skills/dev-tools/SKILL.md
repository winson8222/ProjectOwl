---
name: dev-tools
description: Everyday local dev commands for ProjectOwl — running the test suites, killing a stuck local server, resetting/inspecting the PostgreSQL database. Use whenever asked to run tests, free up port 3000, or reset local data.
---

# ProjectOwl dev tools

## Run the test suites

```bash
npm run test:simplify    # debt-simplification algorithm (10 fixtures)
npm run test:allocation  # receipt item-allocation logic (10 fixtures)
npm run test:settlement  # settlement balances (8 fixtures, in-memory PGlite)
npm run test:security    # validators + debug-endpoint gate (26 fixtures)
```

All are self-contained — simplify/allocation/security are pure in-memory, and
the settlement suite spins up its own in-memory PGlite (Postgres-in-WASM)
instance, so none of them touch the local `projectowl` database. Non-zero
exit code means a failure. Same suites are also runnable from the browser
at `/debug`.

## Kill a stuck local server (port 3000)

```bash
lsof -ti:3000 | xargs kill -9
```

Use this if `npm run dev` / `npm run testmode` reports the port already in
use, or a previous dev server is orphaned. Replace `3000` if the app was
started on a different port.

## Database migrations & seed

```bash
npm run db:generate   # write a versioned SQL migration into drizzle/ after schema.ts changes
npm run db:migrate    # apply pending migrations (uses DIRECT_URL, else DATABASE_URL)
npm run db:seed       # insert demo data (no-op if users exist; refuses in production)
```

## Reset local data

With the server running, hit the debug API:

```bash
curl -X POST "http://localhost:3000/api/debug?action=reset"                       # full wipe + reseed
curl -X POST "http://localhost:3000/api/debug?action=delete-all-transactions"     # keep users, drop transactions
```

Or rebuild the database from scratch:

```bash
dropdb projectowl && createdb projectowl && npm run db:migrate && npm run db:seed
```

(On Windows: `dropdb -U postgres projectowl` etc.)

## Inspect the database

```bash
curl http://localhost:3000/api/debug   # counts, users, transactions as JSON
psql projectowl                        # direct SQL (Windows: psql -U postgres -d projectowl)
```

Or point any Postgres GUI (TablePlus, pgAdmin, DBeaver) at the
`DATABASE_URL` in `.env.local`.

## Linting / build check

```bash
npm run lint
npm run build
```
