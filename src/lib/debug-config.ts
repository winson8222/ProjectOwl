/**
 * Debug / test-mode toggles.
 *
 * These features only turn on in **test mode** — run the app with:
 *
 *     npm run testmode
 *
 * which sets `NEXT_PUBLIC_DEBUG_UI=true` and `NEXT_PUBLIC_MOCK_SCAN=true`.
 * A normal `npm run dev` leaves everything off, so the debug path and the
 * mock-scan option never show up in ordinary use or in production.
 *
 * What test mode unlocks:
 *   - DEBUG_UI: the New Transaction page shows a "🐛 Mock scan" checkbox.
 *   - MOCK_SCAN_ENABLED: "Scan a receipt" loads a canned receipt from
 *     `MOCK_RECEIPTS` instead of calling the LLM at `/api/receipts/extract`,
 *     so you can exercise item allocation for free.
 *
 * You can also set either env var by hand (e.g. in `.env.local`) if you want
 * one without the other.
 */

/** Show the in-page debug UI (mock-scan switch + fixture picker). */
export const DEBUG_UI = process.env.NEXT_PUBLIC_DEBUG_UI === "true";

/** Whether the scan flow should use mock receipts instead of the real API. */
export const MOCK_SCAN_ENABLED = process.env.NEXT_PUBLIC_MOCK_SCAN === "true";
