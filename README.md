# 🦉 ProjectOwl

Split receipts with friends — without the math.

A Splitwise-like PWA built with **Next.js 15**, **Tailwind v4**, and **SQLite** (via Drizzle ORM).

## Features

| Flow | What you can do |
|---|---|
| **Scan a receipt** | Upload a photo → Gemini extracts items/prices/totals → review → assign to friends → save |
| **Manual entry** | Type description + amount → pick participants → split evenly or custom (% or $) → save |
| **Home dashboard** | Net balance, owe/owed breakdown, top debtor/creditor, recent activity, quick actions |
| **Transaction history** | Filter by who paid + who's involved, tap for full breakdown |
| **Transaction detail** | Itemized list with assignment avatars, per-person totals, paid-by badge, settled status |
| **Friends** | List with individual balances (owes you / you owe / settled) |
| **Settle up** | Personalized "who pays who" view with Mark Paid buttons |

## ✅ Status

**Setup Complete** — All dependencies installed, database configured, and ready to run.

## Quick start

### Prerequisites

- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **Google Gemini API key** (free at [aistudio.google.com](https://aistudio.google.com/apikey))
- **C++ build tools** (required by `better-sqlite3` native addon)
  - **macOS**: `xcode-select --install`
  - **Linux**: `sudo apt install build-essential`
  - **Windows**: Visual Studio Build Tools (prompted during setup)

### Setup

**macOS / Linux:**
```bash
chmod +x setup.sh
./setup.sh
```

**Windows (PowerShell):**
```powershell
.\setup.ps1
```

The setup script will:
1. Verify Node.js v18+
2. Check for native build tools (better-sqlite3)
3. Install npm dependencies
4. Create `.env.local` from `.env.example` (add your `GEMINI_API_KEY`)
5. Run a build check

### Start

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first visit, pick your name from the seeded users.

### Reset data

Delete `data/projectowl.db` and restart the server — the database is auto-created with fresh seed data.

## API Routes

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/receipts/extract` | Upload receipt image → returns structured JSON from Gemini |
| `POST` | `/api/transactions` | Create transaction with line items + participant split |
| `GET` | `/api/transactions?userId=` | List transactions (filter by `payer`, `payees`) |
| `GET` | `/api/transactions?id=&userId=` | Single transaction with full details |
| `DELETE` | `/api/transactions?id=` | Soft-delete single transaction (kept for ledger history) |
| `DELETE` | `/api/transactions?all=true` | **Delete ALL transactions** |
| `GET` | `/api/balances?userId=` | Balance summary (net, owe/owed, per-person) |
| `GET` | `/api/settlements/optimize` | Group-wide **minimum-transaction** settlement plan |
| `GET` | `/api/users` | List all users |
| `POST` | `/api/users` | Create a new test user |
| `POST` | `/api/settlements/mark-paid` | Mark a settlement as paid |
| `GET` | `/api/debug` | View DB stats (counts, users, transactions) |
| `GET` | `/api/debug/simplify-tests` | Run the debt-simplification test suite (in-memory) |
| `POST` | `/api/debug?action=reset` | **Full DB reset** — wipes everything and re-seeds |
| `POST` | `/api/debug?action=delete-all-transactions` | **Delete all transactions** (keeps users) |

## Debt simplification

When several people owe each other in overlapping ways, the naive
"everyone-pays-everyone" plan has far more payments than necessary. ProjectOwl
collapses the whole group's debts into the **fewest possible transfers** using a
greedy minimum-cash-flow algorithm (largest debtor pays largest creditor,
repeat) — the same approach used by Splitwise and
[oss-apps/split-pro](https://github.com/oss-apps/split-pro).

The algorithm lives in [`src/lib/simplify.ts`](src/lib/simplify.ts) and is
**pure** — it takes a list of transactions and returns a settlement plan, with
no database or network involved:

- `computeNetBalances(transactions)` → each user's net position (owed vs owes)
- `minimizeTransfers(balances)` → the minimal list of `from → to` payments

The live group plan is served by `GET /api/settlements/optimize`, which reads
the current (non-deleted) transactions and runs the same function.

### Running the tests

The algorithm is covered by 10 scenarios in
[`src/lib/test-data/simplify-fixtures.ts`](src/lib/test-data/simplify-fixtures.ts)
(cycles, chains, star payments, mutual cancellations, dense webs, …). Each
fixture is a plain in-memory list of transactions — **no data is ever written to
the database, so there is nothing to clean up.** Every case is checked against
these invariants: money is conserved, no one pays themselves, all amounts are
positive, and the plan uses at most `n-1` payments (plus an exact expected count
where known).

**From the command line:**
```bash
npm run test:simplify
```
Prints a per-case report and exits non-zero if anything fails.

**From the browser:** open `/debug` and click **Run tests** under
"🧮 Debt-simplification tests" — the same suite runs via
`GET /api/debug/simplify-tests` and renders each scenario's net balances and
resulting plan.

### Viewing SQLite Data

The database is stored at `data/projectowl.db`. To inspect it:

**Via the debug API** (no tools needed):
```bash
curl http://localhost:3000/api/debug
```

**Via a SQLite browser** (recommended for deep inspection):
- **Windows**: Download [DB Browser for SQLite](https://sqlitebrowser.org)
- **macOS**: `brew install --cask db-browser-for-sqlite`
- Open `data/projectowl.db` in the browser

## Page Structure

```
/                          → Home dashboard
/transactions              → Transaction history (filterable)
/transactions/new          → Choose scan or manual
/transactions/new/scan     → Upload → extract → review → save
/transactions/new/manual   → Manual entry form
/transactions/[id]         → Transaction detail
/friends                   → Friend list with balances
/settle-up                 → Settlement view
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx                     # Home dashboard
│   ├── layout.tsx                   # Root layout
│   ├── AppShell.tsx                 # Session wrapper + BottomNav
│   ├── scan/                        # Standalone scan (legacy)
│   ├── transactions/
│   │   ├── page.tsx                 # Transaction list
│   │   ├── [id]/page.tsx            # Transaction detail
│   │   └── new/
│   │       ├── page.tsx             # Type picker
│   │       ├── scan/page.tsx        # Scan + review flow
│   │       └── manual/page.tsx      # Manual entry
│   ├── friends/page.tsx             # Friend list
│   ├── settle-up/page.tsx           # Settlement view
│   └── api/
│       ├── receipts/extract/route.ts  # Gemini receipt OCR
│       ├── transactions/route.ts      # Transactions CRUD
│       ├── balances/route.ts          # Balance computation
│       ├── settlements/mark-paid/     # Mark as settled
│       └── users/route.ts             # User list
├── components/
│   ├── BottomNav.tsx               # 3-tab bottom navigation
│   ├── UserAvatar.tsx              # Colored avatar with initials
│   ├── UserPicker.tsx              # Multi-select participant picker
│   ├── SplitInput.tsx              # Even/custom split (% or $)
│   ├── BalanceCard.tsx             # Net balance display
│   ├── TransactionCard.tsx         # Summary row for list
│   ├── ConfirmDialog.tsx           # Reusable confirmation modal
│   ├── ReceiptUploader.tsx         # Drag-and-drop upload
│   ├── ReceiptResult.tsx           # Extracted item table
│   ├── LoadingOverlay.tsx          # Processing spinner
│   └── ErrorAlert.tsx              # Error display with retry
└── lib/
    ├── db/
    │   ├── schema.ts               # Drizzle ORM table definitions
    │   ├── index.ts                # SQLite client + Drizzle instance
    │   ├── migrate.ts              # Auto-create tables on startup
    │   └── seed.ts                 # Seed users + demo transactions
    ├── actions/
    │   ├── users.ts                # User CRUD + friend balance
    │   ├── transactions.ts         # Transaction CRUD with items
    │   ├── balances.ts             # Balance computation engine
    │   └── settlements.ts          # Settlement plan + mark paid
    ├── llm/
    │   ├── types.ts                # LLMClient interface
    │   ├── gemini-client.ts        # Gemini REST API implementation
    │   └── index.ts                # Factory (createLLMClient)
    ├── schemas/receipt.ts          # Zod schemas for receipt data
    ├── session.ts                  # sessionStorage helper
    ├── errors.ts                   # Error class hierarchy
    └── retry.ts                    # Backoff retry utility
```

## Database

**SQLite** via Drizzle ORM (`better-sqlite3`). Migration to PostgreSQL requires only changing the Drizzle driver + schema dialect — all query logic stays the same.

| Table | Purpose |
|---|---|
| `users` | id, name, email, avatar |
| `friendships` | user ↔ friend edges |
| `transactions` | title, total, paid by, date |
| `transaction_items` | item name, quantity, price per line |
| `item_assignments` | user + share per item |
| `settlements` | debt records with paid status |

All balances are **computed from raw data** on every page load (not stored), ensuring consistency on delete or edit.

## Architecture decisions

- **LLM client interface** — Swap providers (OpenAI, Anthropic) by adding one file + one factory case
- **Zod as single source of truth** — Runtime validation + TypeScript types from one schema
- **Raw REST API over SDK** — Full control over `responseSchema` for structured JSON output
- **Item-level splitting** — Multiple people can share one item via `item_assignments`, enabling exact per-person totals
- **Session via sessionStorage** — Picks user on first visit; no passwords (swap for Clerk/Supabase Auth later)
- **No global state** — Each page fetches its own data; no Redux/Context needed at this scale
