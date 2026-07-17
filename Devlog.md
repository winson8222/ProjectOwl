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

## 2026-07-13 — Unified scan + manual flow with item allocation (feature/unified-scan-and-manual-flow)

### Done
**Unified create flow:**
- Merged the separate `/transactions/new/scan` and `/transactions/new/manual`
  pages into a single `/transactions/new` page. Manual entry is the default;
  "Scan a receipt" is an optional action within the same form. The old routes
  now redirect (client redirect + `next.config.ts` redirects).
- After scanning, a full-screen **"pass the phone" item assigner**: an
  active-user selector sits at the top; each person taps their name, then taps
  the items they shared. All items start unassigned. Item prices stay editable.
- **Multi-quantity items** expand into a main row + one sub-row per unit.
  Tapping the main row assigns the active user to *all* units; tapping a
  sub-row toggles just that unit — so a "Ramen ×2" can go to two different
  people. Shares are therefore uneven-capable.
- After confirming, the receipt + allocation becomes a **read-only reference**
  card (items with their per-person assigned amounts). Buttons: **✎ Edit**
  (re-opens the assigner with prior per-unit state restored exactly) and
  **↺ Reset split to allocation** (re-applies the allocation to the custom
  split fields). The prefilled split stays editable.
- **Even split now resets** custom amounts; switching to Custom preserves them.
- **Paid by** can be any user, not only those in the split.

**Database:**
- Re-introduced the `item_assignments` table (item ↔ user ↔ shareAmount) to
  store the *raw* scan allocation alongside the (possibly-edited) participant
  split. The legacy one-time `item_assignments → participants` migration now
  only fires on the *old* schema shape (detected via a `transaction_id`
  column), so it no longer drops the new table.
- `createTransaction` persists item assignments; `getTransaction` /
  `getTransactions` return them with user names. The detail page shows the
  per-item assignment breakdown.

**Allocation math (pure + tested):**
- Extracted the allocation logic into a pure `computeAllocation()`
  (`src/lib/allocation.ts`) so the `ItemAssigner` UI and the tests share one
  code path — what the UI prefills is exactly what the tests verify.
- Test suite: 10 fixtures (`src/lib/test-data/allocation-fixtures.ts`), a
  runner, CLI `npm run test:allocation`, `GET /api/debug/allocation-tests`, and
  a viz section on `/debug` showing computed-vs-expected totals.

**Test mode (mock scan):**
- `npm run testmode` runs the dev server with `NEXT_PUBLIC_DEBUG_UI=true` and
  `NEXT_PUBLIC_MOCK_SCAN=true` (via `cross-env`). This unlocks a "🐛 Mock scan"
  toggle that loads canned receipts (`MOCK_RECEIPTS`) instead of calling the
  LLM, so the allocation flow can be exercised for free. Normal `npm run dev`
  leaves all debug tooling off. Toggles live in `src/lib/debug-config.ts`.

### Fixed
1. **Penny drift in allocation rounding (save-breaking).** Per-person shares
   were rounded independently, so they didn't sum back to the item price
   (e.g. $10 split 6 ways → $10.02). The prefilled split then failed the
   backend's `SPLIT_MISMATCH` check, making some receipts **unsaveable**.
   Fixed with **largest-remainder (Hamilton) rounding** so shares sum to the
   exact cent, with a per-item rotating tie-break so leftover pennies spread
   fairly across the receipt instead of always hitting the same person.
2. **Frontend split validation used the wrong participant set.** It summed all
   of `splitValues` but sent only `selectedParticipants`; removing someone from
   the picker after allocation could pass the frontend check then get rejected
   by the backend. Now validates over the same set it sends.
3. **Test hardening** — tightened the runner's conservation tolerance
   (0.02 → 0.005, which had *allowed* the drift bug), added a receipt-wide
   "total conserved (saveable)" check mirroring the backend validation, and
   added regression fixtures (`rounding-sixths`, corrected `rounding-thirds`).

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

## 2026-07-15 — UI Responsive Design & Transaction Sorting Fixes

### Fixed
1. **ItemAssigner responsive design for desktop** — The full-screen item assignment
   interface was taking up the entire screen width on desktop, making it hard to use.
   Added `md:max-w-3xl md:mx-auto` to constrain width to 768px on medium+ screens while
   maintaining full-screen mobile experience.

2. **Transaction sorting order on home page** — Recent transactions were sorted by
   `createdAt` (system entry time) instead of `transactionDate` (actual transaction date),
   causing confusing ordering. Changed `.orderBy(desc(schema.transactions.createdAt))`
   to `.orderBy(desc(schema.transactions.transactionDate))` so latest transactions by
   actual date appear at the top.

3. **Integrated calculator keypad from yf-feature-1 branch** — Merged the complete
   calculator keypad implementation with all expense entry flows, providing mobile-
   friendly numeric input with addition expression support.

### Technical Implementation
- **ItemAssigner.tsx**: Added responsive constraints with `md:max-w-3xl md:mx-auto`
- **transactions.ts**: Changed sort field from `createdAt` to `transactionDate`
- **CalculatorKeypad.tsx**: Full integration with auto-calculate on exit behavior

### Testing
✅ Desktop ItemAssigner now constrained to reasonable width
✅ Mobile ItemAssigner remains full screen (as intended)
✅ Home page transactions sorted by actual transaction date (newest first)
✅ Calculator keypad functional across all entry points

### Files Modified
- `src/components/ItemAssigner.tsx` - Responsive design fix
- `src/lib/actions/transactions.ts` - Transaction sorting fix
- `DEVLOG.md` - Implementation notes

## 2026-07-16 — User-friendly error messages across all API routes and frontend pages

### Done
**Centralized error pattern mapping:**
- Added `MAPPED_ERRORS` to `src/lib/constants.ts` — 15 pattern-to-message mappings covering:
  - SQLite `NOT NULL constraint failed` for transactions, users, and settlements
  - `FOREIGN KEY constraint failed` (invalid user references)
  - `UNIQUE constraint failed`
  - Generic database errors (connection, missing tables, corrupted DB)
  - Network/fetch errors (connection refused, JSON parse failures)
- Added `mapErrorMessage(err)` helper that checks a caught error against all patterns
  and returns a user-friendly string. Falls back to `"An unexpected error occurred"` when
  no pattern matches, so users never see raw SQL or internal error text.

**API routes — all 8 routes now use `mapErrorMessage()` in catch blocks:**
- `GET/POST/DELETE /api/transactions`
- `GET/POST /api/users`
- `GET /api/balances`
- `POST /api/settlements/mark-paid`
- `GET /api/settlements/optimize`
- `POST /api/receipts/extract`
- `GET/POST /api/debug`

Previously, a missing title would send `"NOT NULL constraint failed: transactions.title"`
to the frontend. Now it sends `"Transaction description is required."`
(The raw error is still logged server-side via `console.error`.)

**Frontend pages — error display for GET failures:**
Every page that fetches data from the API now shows an inline red error banner when
a GET request fails, instead of silently swallowing the error in `console.error`:

| Page | What fails | User sees |
|---|---|---|
| Home (`/`) | Balance or recent transactions | ⚠ error banner below greeting |
| Transactions (`/transactions`) | Transaction list + user filters | ⚠ error banner below header |
| Friends (`/friends`) | User list | ⚠ error banner below title |
| Settle Up (`/settle-up`) | Balance data | ⚠ error banner above summary |
| Transaction Detail (`/transactions/[id]`) | Single transaction load | Error text + "Try again" button |
| New Transaction (`/transactions/new`) | User list for pickers | Error shown in existing error slot |
| New Transaction (scan upload) | Network error during scan | Uses `mapErrorMessage()` instead of raw error |

**Files changed:**
- `src/lib/constants.ts` — Added `MAPPED_ERRORS`, `mapErrorMessage()`, import of `AppError`
- `src/app/api/transactions/route.ts` — 3 catch blocks updated
- `src/app/api/users/route.ts` — 2 catch blocks updated
- `src/app/api/balances/route.ts` — 1 catch block updated
- `src/app/api/settlements/mark-paid/route.ts` — 1 catch block updated
- `src/app/api/settlements/optimize/route.ts` — 1 catch block updated
- `src/app/api/receipts/extract/route.ts` — 1 catch block updated
- `src/app/api/debug/route.ts` — 2 catch blocks updated
- `src/app/page.tsx` — Error state + banner for GET failures
- `src/app/transactions/page.tsx` — Error state + banner for GET failures
- `src/app/friends/page.tsx` — Error state + banner for GET failures
- `src/app/settle-up/page.tsx` — Error state + banner for GET failures
- `src/app/transactions/[id]/page.tsx` — Error state + banner for GET/DELETE failures
- `src/app/transactions/new/page.tsx` — `mapErrorMessage()` for scan/save catch blocks

**ErrorDialog component:**
- Created `src/components/ErrorDialog.tsx` — modal overlay for POST action failures (save, delete, mark-paid)
- Matches the existing `ConfirmDialog` style: dimmed backdrop, centered white card, ⚠️ icon, single dismiss button
- Used on 3 pages for POST error display instead of inline `<p>` text

**Generic LLM error messages:**
- Added 8 LLM-specific patterns to `MAPPED_ERRORS` that convert provider-specific messages into generic text:
  - `"Gemini API returned 429: ..."` → `"Failed to scan receipt. Please try again."`
  - `"Gemini returned no text (finishReason: SAFETY)"` → `"Receipt scan returned no data. The image may be invalid or blurry."`
  - `"GEMINI_API_KEY is not set"` → `"Scan is unavailable. The API key has not been configured."`
  - `"You've exceeded the daily quota"` → `"Scan is temporarily unavailable. Please try again later."`
- Reordered `mapErrorMessage()` to check patterns FIRST before falling back to `AppError.message`
- This means LLMError messages get caught by the pattern matcher, while normal AppErrors (like "Transaction not found") still pass through unchanged

**Debug menu:**
- Created `src/components/DebugMenu.tsx` — floating 🐛 button when `DEBUG_UI=true` (appears at bottom-left)
- Page-aware: shows different error simulator buttons depending on the current route
- DB actions: "Delete all transactions" and "Full database reset" directly from any page
- Error simulators trigger the ErrorDialog with realistic messages — no need to cause real errors
- Integrated into `AppShell.tsx` so it appears on every page

**Error reference doc:**
- Created `docs/error-test-cases.md` — 23 error conditions with trigger steps and expected results

**New files added:**
- `src/components/ErrorDialog.tsx` — error modal overlay
- `src/components/DebugMenu.tsx` — floating debug panel with DB actions + error simulators
- `docs/error-test-cases.md` — error conditions reference

**Files modified:**
- `src/lib/constants.ts` — Added LLM patterns to MAPPED_ERRORS; reordered mapErrorMessage logic
- `src/app/AppShell.tsx` — Import and render DebugMenu
- `src/app/transactions/new/page.tsx` — ErrorDialog for POST save errors
- `src/app/transactions/[id]/page.tsx` — ErrorDialog for delete + mark-settled errors
- `src/app/settle-up/page.tsx` — ErrorDialog for mark-paid errors

## 2026-07-16 — Fix: Settle-up "Mark paid" never worked

### Fixed
1. **"Mark paid" flow was broken end-to-end.** Three interacting bugs:
   - **Frontend generated a fake settlement ID** (`settlement-${from}-${to}-${Date.now()}`) and sent it to the API, but never created a settlement record first. The backend's `markSettled()` tried to UPDATE a non-existent row, so `result.changes` was always 0 and it returned 404.
   - **`markSettled()` set `settledAt` to an ISO date string** (`new Date().toISOString()`), but every balance query checked for the literal string `"PAID"` — so even the seed settlement would never affect displayed balances if it were marked.
   - **No API route existed to create a settlement.** The `createSettlement()` action existed in `settlements.ts` but had no corresponding API endpoint.

2. **Consolidated into a single action** `createAndMarkPaid(fromUserId, toUserId, amount)` that creates the settlement record and marks it paid in one step. The API route now accepts `{ fromUserId, toUserId, amount }` directly.

3. **Fixed `markSettled()` to set `settledAt: "PAID"`** instead of an ISO timestamp, matching what all balance queries expect.

### Files changed
- `src/lib/actions/settlements.ts` — Added `createAndMarkPaid()`, fixed `markSettled()` to use `"PAID"` constant
- `src/app/api/settlements/mark-paid/route.ts` — Accepts `{ fromUserId, toUserId, amount }` instead of fake `settlementId`
- `src/app/settle-up/page.tsx` — Sends proper body instead of made-up settlement ID

## 2026-07-16 — Fix: Balance formula sign error, "Mark as settled" removal, settlement tests

### Fixed
1. **Balance formula sign error in both `balances.ts` and `users.ts`.** The settlement amounts for "friend already paid user" were being **added** to the net balance instead of subtracted. When Alex paid you $50 via settle-up, the formula `friendOwesUser - userOwesFriend + friendPaidUser - userPaidFriend` made it look like Alex owed you MORE, not less. Fixed both to use `- friendPaidUser + userPaidFriend`, so a settlement payment correctly reduces the outstanding debt.

2. **Removed "Mark as settled" button from transaction detail page.** Transaction-level settling was conceptually wrong — settling should be user-to-user only (paying off the net balance between two people, not marking individual line items as paid). Removed the `handleMarkSettled` function and its button.

### Added
3. **Settlement-balance test suite** — 8 in-memory test fixtures covering:
   - Simple debt + full settlement → net zero
   - Partial settlement → correct remaining balance
   - Over-payment → flips the balance direction
   - Multi-person with one settling
   - Transactions in both directions + settlement
   - User paying friend (settlement from user to friend)
   - No transactions → net zero
   - Multiple settlement payments accumulating to full payment

   Run: `npm run test:settlement` (CLI) or visit `/debug` (browser). Pure in-memory — no server needed, no data touched.

### Files changed
- `src/lib/actions/balances.ts` — Fixed balance formula: `+ friendPaidUser` → `- friendPaidUser`; added optional `_db` param for test injection
- `src/lib/actions/users.ts` — Same sign fix: `+ friendAlreadyPaid` → `- friendAlreadyPaid`
- `src/app/transactions/[id]/page.tsx` — Removed `handleMarkSettled` function and "Mark as settled" button
- `src/lib/test-data/settlement-fixtures.ts` — 8 test scenarios (new file)
- `src/lib/test-data/run-settlement-tests.ts` — In-memory test runner (new file)
- `scripts/run-settlement-tests.ts` — CLI runner (new file)
- `src/app/api/debug/settlement-tests/route.ts` — Debug API endpoint (new file)
- `src/app/debug/page.tsx` — Settlement test suite viz section
- `package.json` — Added `test:settlement` script
