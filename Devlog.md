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
