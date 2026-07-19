/**
 * Fixtures for the security-hardening test suite (`npm run test:security`).
 *
 * Each fixture is plain data describing an input and the expected security
 * decision. The runner feeds them to the real validators in
 * [`src/lib/security.ts`](../security.ts) and [`src/lib/debug-guard.ts`](../debug-guard.ts),
 * so the tests assert the exact logic the API routes run — with no HTTP, DB, or
 * UI in the loop. They stay valid across UI/route refactors because they target
 * that pure logic directly.
 */
import type { TransactionAmountInput } from "../security";

// ── Transaction money validation ────────────────────────────────────
export interface MoneyFixture {
  name: string;
  description: string;
  input: TransactionAmountInput;
  expectValid: boolean;
}

export const MONEY_FIXTURES: MoneyFixture[] = [
  {
    name: "even-split",
    description: "Normal split — total and shares all positive, sum consistent.",
    input: { totalAmount: 20, participants: [{ shareAmount: 10 }, { shareAmount: 10 }], items: [{ price: 20, quantity: 1 }] },
    expectValid: true,
  },
  {
    name: "zero-amounts",
    description: "Zero is allowed by the money validator (0 is non-negative).",
    input: { totalAmount: 0, participants: [{ shareAmount: 0 }] },
    expectValid: true,
  },
  {
    name: "no-items",
    description: "Items are optional — a valid transaction may omit them.",
    input: { totalAmount: 15, participants: [{ shareAmount: 15 }] },
    expectValid: true,
  },
  {
    name: "negative-total",
    description: "EXPLOIT: negative total + negative share passes the split-sum check but corrupts balances.",
    input: { totalAmount: -100, participants: [{ shareAmount: -100 }] },
    expectValid: false,
  },
  {
    name: "negative-share",
    description: "One negative share among positives — must be rejected.",
    input: { totalAmount: 20, participants: [{ shareAmount: 25 }, { shareAmount: -5 }] },
    expectValid: false,
  },
  {
    name: "nan-total",
    description: "NaN total must be rejected.",
    input: { totalAmount: NaN, participants: [{ shareAmount: 0 }] },
    expectValid: false,
  },
  {
    name: "infinity-total",
    description: "Infinity total must be rejected.",
    input: { totalAmount: Infinity, participants: [{ shareAmount: Infinity }] },
    expectValid: false,
  },
  {
    name: "string-total",
    description: "A non-number (string off untrusted JSON) must be rejected.",
    input: { totalAmount: "20" as unknown as number, participants: [{ shareAmount: 20 }] },
    expectValid: false,
  },
  {
    name: "negative-item-price",
    description: "Negative item price must be rejected even when totals look fine.",
    input: { totalAmount: 10, participants: [{ shareAmount: 10 }], items: [{ price: -5, quantity: 1 }] },
    expectValid: false,
  },
];

// ── Settlement amount validation ────────────────────────────────────
export interface AmountFixture {
  name: string;
  description: string;
  amount: unknown;
  expectValid: boolean;
}

export const SETTLEMENT_AMOUNT_FIXTURES: AmountFixture[] = [
  { name: "positive", description: "A normal positive payment.", amount: 42.5, expectValid: true },
  { name: "zero", description: "Zero is not a payment.", amount: 0, expectValid: false },
  { name: "negative", description: "Negative amounts must be rejected.", amount: -10, expectValid: false },
  { name: "nan", description: "NaN must be rejected.", amount: NaN, expectValid: false },
  { name: "infinity", description: "EXPLOIT: Infinity passed the old `amount > 0` check.", amount: Infinity, expectValid: false },
  { name: "string", description: "A non-number must be rejected.", amount: "10" as unknown, expectValid: false },
];

// ── Limit clamping ──────────────────────────────────────────────────
export interface LimitFixture {
  name: string;
  description: string;
  raw: string | null;
  expect: number;
}

export const LIMIT_FIXTURES: LimitFixture[] = [
  { name: "default", description: "Missing param falls back to 50.", raw: null, expect: 50 },
  { name: "normal", description: "A sensible value passes through.", raw: "100", expect: 100 },
  { name: "min-clamp", description: "0 is clamped up to 1.", raw: "0", expect: 1 },
  { name: "negative-clamp", description: "Negative is clamped up to 1.", raw: "-5", expect: 1 },
  { name: "max-clamp", description: "A huge value is clamped down to 200.", raw: "999999", expect: 200 },
  { name: "garbage", description: "Non-numeric input falls back to 50.", raw: "abc", expect: 50 },
];

// ── Debug-endpoint gating ───────────────────────────────────────────
export interface DebugGateFixture {
  name: string;
  description: string;
  env: { NODE_ENV?: string; ALLOW_DEBUG_ENDPOINTS?: string };
  expectEnabled: boolean;
}

export const DEBUG_GATE_FIXTURES: DebugGateFixture[] = [
  {
    name: "development",
    description: "Dev (npm run dev / testmode) — debug endpoints enabled.",
    env: { NODE_ENV: "development" },
    expectEnabled: true,
  },
  {
    name: "production-blocked",
    description: "CRITICAL: production build blocks the DB-wipe / data-dump endpoints.",
    env: { NODE_ENV: "production" },
    expectEnabled: false,
  },
  {
    name: "production-override",
    description: "Explicit ALLOW_DEBUG_ENDPOINTS re-enables them in production on purpose.",
    env: { NODE_ENV: "production", ALLOW_DEBUG_ENDPOINTS: "true" },
    expectEnabled: true,
  },
  {
    name: "test-env",
    description: "Any non-production env counts as enabled.",
    env: { NODE_ENV: "test" },
    expectEnabled: true,
  },
  {
    name: "undefined-env",
    description: "Missing NODE_ENV is treated as non-production (enabled).",
    env: {},
    expectEnabled: true,
  },
];
