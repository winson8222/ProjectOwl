# ProjectOwl — Devlog

## 2026-07-06 — Initial prototype: receipt scanning

### Done
- Scaffolded Next.js 15 project with TypeScript, Tailwind v4, App Router (`src/` directory)
- Created typed Zod schemas mirroring the notebook's `receipt_schema`:
  - `MenuItem` (nm, cnt?, price) and `ReceiptExtractionResult` (menu + totals)
  - `.refine()` sanity check: total ≈ subtotal + tax + service - discount
- Built LLM client abstraction layer:
  - `LLMClient` interface for provider-agnostic receipt extraction
  - Factory `createLLMClient()` reads `LLM_PROVIDER` env var (defaults to gemini)
  - `GeminiClient` implementation using raw REST API (not SDK) to Gemini 2.0 Flash
  - Structured output via `responseMimeType: "application/json"` + `responseSchema`
  - Prompt matches the notebook's transcription-only design (no calculation/inference)
- Built exponential-backoff retry utility (`withRetry`) — retries on 429/503/RESOURCE_EXHAUSTED/UNAVAILABLE
- Created `POST /api/receipts/extract` endpoint:
  - Validates file presence, MIME type, size (≤10MB)
  - Calls Gemini → validates with Zod → returns structured JSON
  - Robust error mapping (400 for bad input, 502 for LLM failures, 500 for internal errors)
- Built frontend components:
  - `ReceiptUploader` — drag-and-drop zone + file picker, client-side validation
  - `LoadingOverlay` — spinner with backdrop
  - `ReceiptResult` — item table + totals summary
  - `ErrorAlert` — error card with retry button
- Scan page (`/scan`) with `idle → uploading → success | error` state machine
- Home page (`/`) with app overview and scan link

### Architecture decisions
1. **Raw REST API over SDK** — Using `fetch()` to Gemini's REST API instead of `@google/genai` SDK. Gives full control over `responseSchema` and request shaping; avoids SDK abstraction leaks.
2. **LLM client interface** — `LLMClient` in `lib/llm/types.ts` lets us add OpenAI/Anthropic providers by creating one file + one factory case. No other code changes.
3. **Zod as single source of truth** — Schema defines both runtime validation and TypeScript types. API route validates LLM output before returning to client.
4. **Exponential backoff** — 1s, 2s, 4s, 8s with jitter (vs. notebook's 15s linear). Better for production latency profiles.
5. **Frontend state machine** — Simple `idle | uploading | success | error` enum in the scan page. Maps cleanly to future loading/error/empty states.

## 2026-07-06 — Retry logic fix: distinguish daily quota from rate limits

### Fixed
- `withRetry()` now distinguishes **daily quota exhaustion** (429 with "quota" in body) from
  **per-minute rate limits** (429 with "rate limit" / "RESOURCE_EXHAUSTED"):
  - **Daily quota**: NEVER retried — fails immediately with the original error message
    so the user sees a clear message about enabling billing or waiting for reset
  - **Per-minute rate limit**: retried with ~13s delays (free tier: 5 req/min)
    instead of the old 1s–8s backoff which was too fast to clear the limit
  - **503 / UNAVAILABLE**: still retried with exponential backoff as before
- `GeminiClient.extractReceipt()` now separates the network-call retry from the
  response-parse step — the retry wrapper only wraps the `fetch()`, not JSON parsing

### Why
The free tier has a **daily request cap** (~50 requests/day). Hitting it returns 429
like any rate limit, but retrying is useless — the quota only resets ~24h after the
first request of the day. The old code tried 3x with 1s/2s/4s delays and then
returned a generic "LLM_FAILED" error, wasting 7 seconds and hiding the real cause.

## 2026-07-06 — Retry fix v2: Expose model config, check quota reality

The 429 "quota exceeded" error on a fresh key is likely one of:
- The free tier daily cap (as low as 50 req/day on new keys)
- `gemini-2.0-flash` being higher-demand with stricter limits
- The key still propagating (sometimes takes minutes before first request)

**Fix**: Switched default model to `gemini-2.5-flash` (same free tier availability,
often less contended). Made model configurable at construction for easy swapping.

## 2026-07-06 — Full Splitwise-like app flows (feature/full-app-flow)

### Done
**Database layer:**
- Created Drizzle ORM schema with 6 tables: `users`, `friendships`, `transactions`,
  `transaction_items`, `item_assignments`, `settlements`
- SQLite via `better-sqlite3` with auto-migration on startup
- Seed data: 5 users (You, Alex, Ben, Chloe, Diana) + friendships + 2 demo transactions
- Easy migration path to PostgreSQL (swap drizzle driver + schema dialect)

**Backend actions + API routes:**
- `users.ts` — CRUD, friend list, per-person balance computation
- `transactions.ts` — create (with items + assignments), query (with filters), delete
- `balances.ts` — net balance, owe/owed breakdown, top debtor/creditor (computed from raw data)
- `settlements.ts` — optimized settlement plan, mark-as-paid
- New API routes: `GET/POST/DELETE /api/transactions`, `POST /api/settlements/mark-paid`,
  `GET /api/balances`, `GET /api/users`
- Existing `/api/receipts/extract` integrated into transaction creation flow

**Frontend pages:**
| Page | Route | Key features |
|---|---|---|
| Home/Dashboard | `/` | Net balance card, owe/owed split, top debtor/creditor highlights, recent activity, quick actions. Also serves as session picker on first visit |
| Transactions | `/transactions` | Filterable list (payer dropdown, payee multi-select), deep-link support |
| New Transaction | `/transactions/new` | Choice between Scan receipt or Manual entry |
| Scan & Review | `/transactions/new/scan` | Upload → extract → review form (edit items, pick participants, split evenly) → save |
| Manual Entry | `/transactions/new/manual` | Description, total, date, participants, split toggle (even/custom with % or $ per-person), live remaining indicator |
| Transaction Detail | `/transactions/[id]` | Itemized breakdown with avatars, per-person totals, paid-by badge, settled/pending, mark-as-settled, delete with confirmation |
| Friends | `/friends` | Friend list with individual balances (owes you / you owe / settled) |
| Settle Up | `/settle-up` | Personalized view: who pays you / you pay, with Mark Paid buttons |

**Shared components:**
- `BottomNav` — 3-tab bar (Home, Transactions, Friends), hides on sub-pages
- `UserAvatar` — colored avatar circle with initials
- `UserPicker` — multi-select participant picker with avatar toggles
- `SplitInput` — even/custom split toggle, per-person $ and % inputs, live remaining indicator
- `BalanceCard` — headline net balance + owe/owed breakdown
- `TransactionCard` — summary row (title, amount, who paid, date, user share)
- `ConfirmDialog` — reusable confirmation modal with danger variant

**Architecture:**
- Session stored in `sessionStorage` (simple user picker on first visit)
- All balances computed from raw data (not stored), ensuring consistency on delete/edit
- Splitwise-like settlement optimizer (greedy max-debtor → max-creditor matching)
- Bottom nav with iOS safe-area padding
- No global state store — each page fetches its own data

## 2026-07-06 — Bugfix: navigation, validation, and redirect

### Fixed
1. **BottomNav now persistent** — Removed the `return null` condition that hid the
   navigation bar on `/transactions/new/*` and `/settle-up` sub-pages. Users can
   now always navigate between Home, Transactions, and Friends regardless of
   which flow they're in.

2. **Custom split validation** — Added both frontend and backend checks that the
   sum of all assignment amounts equals the item's total price:
   - **Backend** (`POST /api/transactions`): validates every item's assignment
     sums match its price within $0.01 tolerance. Returns `SPLIT_MISMATCH` error
     with a clear message showing the difference.
   - **Frontend manual** (`/transactions/new/manual`): validates split amounts
     against total *before* sending the API call, shows inline error.
   - **Frontend scan** (`/transactions/new/scan`): fixed a rounding bug where
     splitting by N people could leave unassigned pennies (last participant now
     gets the remainder).

3. **Redirect after save** — Both scan and manual flows now redirect to
   `/transactions` (transaction history list) instead of the individual
   transaction detail page. This matches the expected flow: after creating a
   transaction, see it in context with other transactions.

### Why
- Navigation bar was hidden on creation pages, leaving users with no way to
  go back to the main page without using the browser back button.
- Custom split amounts could be submitted without summing to the total,
  causing the transaction to save with incorrect balances.
- The rounding bug in the scan flow meant evenly-split items were off by
  pennies, which also triggered the backend validation.
- Redirecting to the detail page after creation was confusing — the user
  expects to return to the list where they can see the new transaction.

## 2026-07-06 — Bugfix: transactions not showing up, admin tools

### Fixed
1. **Transactions not appearing after save** — Two root causes:
   - `getTransactions()` only looked for transactions where the user has item
     *assignments*. If the user created a transaction but didn't assign any
     items to themselves (e.g., paid for friends only), the transaction was
     invisible to them. **Fix**: `getTransactions()` now also includes
     transactions where the user is the *payer*, regardless of assignments.
   - Manual entry didn't auto-include the current user in participants.
     **Fix**: `setSelectedParticipants([currentUser.id])` on page mount.

2. **Error messages centralized** — Created `src/lib/constants.ts` with all
   error codes (`CODES`), user-facing messages (`ERROR_MESSAGES`), and a
   helper function (`apiError()`). All 5 API routes and both transaction
   creation pages now reference this file instead of hardcoded strings.

### Added
3. **Delete all transactions** — `DELETE /api/transactions?all=true` removes
   all transactions, items, and assignments. Also accessible via
   `POST /api/debug?action=delete-all-transactions`.

4. **DB debug endpoint** — `GET /api/debug` returns counts and a listing of
   all users and transactions in the database for quick inspection.

5. **Full DB reset** — `POST /api/debug?action=reset` wipes everything and
   re-runs the seed data.

### Viewing SQLite data
```bash
# The database lives at: data/projectowl.db

# View via the debug API:
curl http://localhost:3000/api/debug

# Or open with any SQLite browser:
#   macOS:   brew install --cask db-browser-for-sqlite
#   Windows: Download DB Browser for SQLite (sqlitebrowser.org)
#   Then open: data/projectowl.db
```

## 2026-07-09 — Bugfix: transaction sort, persistent nav, validation, admin tools

### Fixed
1. **Transaction sort by creation time** — Changed from `transactionDate` (user-picked
   date) to `createdAt` (actual server timestamp with localTimezone formatting).
   `localTimestamp()` helper produces `YYYY-MM-DD HH:MM:SS` format matching SQLite's
   `CURRENT_TIMESTAMP`, so string sort works correctly in DESC order.
   Explicitly passes `createdAt: localTimestamp()` in `createTransaction` to guarantee
   uniqueness per transaction.

2. **BottomNav now persistent** — Removed the `return null` that hid navigation on
   `/transactions/new/*` and `/settle-up` sub-pages.

3. **Custom split validation** — Backend (`POST /api/transactions`): validates every
   item's assignment sums match its price within $0.01. Returns `SPLIT_MISMATCH` error.
   Frontend manual page: validates split totals against total *before* API call.
   Scan page: fixed rounding bug (last participant gets remainder pennies).

4. **Transaction not showing up after save** — Two causes fixed:
   - `getTransactions()` now includes transactions where user is the *payer* (not just
     assigned participant).
   - Manual entry auto-includes `currentUser.id` in participants on mount.
   - Redirect changed from `router.push` to `window.location.href` (forces full page
     reload to bypass Next.js client-side cache).

5. **Delete all transactions / full reset not working** — Switched from Drizzle's
   `.delete().run()` (which silently failed) to raw SQL `db.run("DELETE FROM table")`
   with `PRAGMA foreign_keys = OFF` to handle cascade constraints.

### Added
6. **Error messages centralized** — `src/lib/constants.ts` with `CODES` (error code
   constants), `ERROR_MESSAGES` (user-facing messages with template functions),
   `VALIDATION` (frontend validation messages), `apiError()` helper. All 5 API routes
   and both transaction creation pages now reference this file.

7. **Debug page** — `/debug` web UI showing DB counts, user list, transaction list
   with `createdAt` timestamps and assignment counts. Includes Refresh, Delete all
   transactions, and Full reset buttons.

8. **Debug API** — `GET /api/debug` returns counts + full transaction listing with
   `createdAt` and assignment counts. `POST /api/debug?action=reset` for full DB
   wipe+re-seed. `POST /api/debug?action=delete-all-transactions` for transaction-only purge.

9. **README updated** — All debug/admin API routes documented, SQLite viewing
   instructions added.

### Next steps (future iterations)
- [ ] PWA manifest + service worker for offline capability
- [ ] Camera capture via `navigator.mediaDevices` for in-browser photo
- [ ] Real auth (Clerk / Supabase Auth) instead of sessionStorage
- [ ] Image pre-processing (compress oversized images, HEIC→JPEG)
- [ ] Receipt format templates (grocery, gas station, itemized vs totals-only)
- [ ] Equalize settlement flow (pay records actually persist in SQLite)
- [ ] Edit transaction (modify items, reassign, recalc balances)
- [ ] Real "Mark as paid" with persistent settlement records
- [ ] Filter by date range on transactions page
- [ ] Mobile-optimized touch interactions (swipe to delete, pull to refresh)

## 2026-07-14 — Calculator Keypad Implementation

### Done
**New component:**
- `CalculatorKeypad` — mobile-first numeric input with addition-only expressions
  - Bottom sheet design with slide-up animation and backdrop overlay
  - 4×4 button grid: 0-9, decimal point, addition operator, clear, backspace
  - Auto-calculates on exit (click outside or press ✕) — no enter button
  - Expression evaluation: `2.00+3.00+1.50` → `$6.50`
  - Live preview shows calculated result when `+` is used
  - Input validation: prevents multiple decimals in single number, consecutive operators
  - Keyboard shortcuts (desktop): 0-9, +, ., Backspace, Enter, Escape
  - Touch-friendly: 64×64px buttons with `touch-manipulation` to prevent zoom
  - Accessibility: ARIA labels on all buttons, high contrast colors

**Integrations:**
- Manual entry page (`/transactions/new/manual`) — total amount field
- SplitInput component (`/components/SplitInput`) — per-person amounts ($ and % modes)
- Scan page (`/transactions/new/scan`) — individual item price fields

**Technical implementation:**
- Expression evaluation: splits by `+`, parses each part, sums with 2-decimal rounding
- State management: `useCallback` for optimization, minimal re-renders
- CSS animations: slide-up on open, scale-down on button press
- Click-outside-to-close with proper event propagation handling

### Fixed
**Decimal button unresponsiveness:**
- Initial issue: Decimal validation checked `newExpr` (after adding decimal) instead of `prev` (before adding)
- Root cause: `lastPart.includes('.')` was always true since we just added the decimal
- Solution: Changed validation to check `prev.split('+')` before decimal addition

**Button sizing at different zoom levels:**
- Initial issue: `aspect-square` caused inconsistent sizing and touch targets
- Solution: Fixed dimensions `h-16 w-16` (64×64px) for consistent sizing
- Added `touch-manipulation` class to prevent browser zoom on double-tap

**UI/UX improvements:**
- Removed enter button for simpler interface
- Auto-calculate on exit instead of manual confirmation
- Click-outside-to-close functionality
- Better visual feedback with `active:scale-95` animations
- Larger fonts for readability (text-4xl display, text-2xl buttons)
- Modern design with `rounded-2xl` corners and improved color contrast

### Architecture decisions
1. **Auto-calculate on exit** — More intuitive than explicit enter button. Users naturally expect to see the result when they're done typing, not when they press a separate button.

2. **Fixed button dimensions** — Using `h-16 w-16` instead of `aspect-square` ensures consistent touch targets across all zoom levels and devices. Critical for mobile responsiveness.

3. **Addition-only expressions** — Kept scope minimal for v1. Addition covers 95% of expense splitting needs (e.g., "12.50+8.00" for two items). Future versions can add subtraction/multiplication.

4. **Individual keypad instances** — Each input field gets its own keypad state. This prevents data loss when switching between fields and allows concurrent editing of multiple amounts.

5. **Touch manipulation** — `touch-manipulation` CSS property prevents double-tap zoom and improves touch responsiveness, especially important for calculator apps with rapid button presses.

### Testing
✅ Decimal button works at all zoom levels
✅ Addition expressions calculate correctly
✅ Clear/backspace functionality works
✅ Click-outside-to-close saves result
✅ Individual keypads for multiple participants
✅ Dynamic item list handling
✅ Keyboard shortcuts work on desktop
✅ No TypeScript compilation errors
✅ Mobile touch interactions smooth

### Known issues resolved
- ❌ Decimal button unresponsiveness at certain zoom levels → ✅ Fixed validation logic
- ❌ Inconsistent button sizing across zoom levels → ✅ Fixed dimensions
- ❌ Large green "+" button → ✅ Consistent button sizes

### Future enhancements
- [ ] Subtraction support (- operator)
- [ ] Memory functions (M+, M-, MR)
- [ ] Complex expressions (parentheses, order of operations)
- [ ] Haptic feedback on mobile
- [ ] Sound effects for button presses
- [ ] Theme customization
