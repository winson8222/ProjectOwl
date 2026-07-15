---
name: dev-tools
description: Everyday local dev commands for ProjectOwl — running the test suites, killing a stuck local server, resetting/inspecting the SQLite database. Use whenever asked to run tests, free up port 3000, or reset local data.
---

# ProjectOwl dev tools

## Run the test suites

```bash
npm run test:simplify    # debt-simplification algorithm (10 fixtures)
npm run test:allocation  # receipt item-allocation logic (9 fixtures)
```

Both are pure/in-memory — nothing touches `data/projectowl.db`, so there's
nothing to clean up afterward. Non-zero exit code means a failure. Same
suites are also runnable from the browser at `/debug`.

## Kill a stuck local server (port 3000)

```bash
lsof -ti:3000 | xargs kill -9
```

Use this if `npm run dev` / `npm run testmode` reports the port already in
use, or a previous dev server is orphaned. Replace `3000` if the app was
started on a different port.

## Reset local data

Delete the SQLite file(s) and restart the dev server — it auto-creates the
DB with fresh seed data:

```bash
rm -f data/projectowl.db data/projectowl.db-shm data/projectowl.db-wal
```

Or, with the server running, hit the debug API instead of restarting:

```bash
curl -X POST "http://localhost:3000/api/debug?action=reset"                       # full wipe + reseed
curl -X POST "http://localhost:3000/api/debug?action=delete-all-transactions"     # keep users, drop transactions
```

## Inspect the database

```bash
curl http://localhost:3000/api/debug   # counts, users, transactions as JSON
```

For deeper inspection, open `data/projectowl.db` in DB Browser for SQLite
(`brew install --cask db-browser-for-sqlite` on macOS).

## Linting / build check

```bash
npm run lint
npm run build
```
