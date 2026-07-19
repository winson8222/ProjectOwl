/**
 * Pure security-validation helpers shared by the API routes.
 *
 * These encode the *decisions* behind the security hardening (reject corrupt
 * money values, clamp query limits, gate debug endpoints) as plain functions
 * with no HTTP, DB, React, or Next.js dependency. The routes call them and the
 * test suite (`npm run test:security`) asserts them, so both exercise the same
 * code path — and the tests stay valid no matter how the UI or routes are
 * reshaped, because they target this logic directly.
 */
import { isNonNegativeMoney } from "./constants";

/** The money-bearing fields of a create-transaction request. Typed as
 *  `unknown` because they arrive off untrusted JSON — validation is the point. */
export interface TransactionAmountInput {
  totalAmount: unknown;
  participants: { shareAmount: unknown }[];
  items?: { price: unknown; quantity: unknown }[];
}

/**
 * True only when every money field on a transaction is a finite, non-negative
 * number. Guards against the balance-corruption exploit where a negative total
 * plus negative shares still passes the split-sum check.
 */
export function transactionAmountsValid(input: TransactionAmountInput): boolean {
  const values: unknown[] = [
    input.totalAmount,
    ...input.participants.map((p) => p.shareAmount),
    ...(input.items ?? []).flatMap((i) => [i.price, i.quantity]),
  ];
  return values.every(isNonNegativeMoney);
}

/**
 * True when a settlement amount is a finite number strictly greater than 0.
 * The `> 0` alone let `Infinity` through (Infinity > 0 is true); the finite
 * check closes that.
 */
export function settlementAmountValid(amount: unknown): amount is number {
  return isNonNegativeMoney(amount) && amount > 0;
}

/**
 * Clamp a raw `limit` query-string value to a safe range so a huge or garbage
 * value can't ask the server for an unbounded result set. Non-numeric / missing
 * input falls back to the default.
 */
export function clampLimit(raw: string | null, fallback = 50, max = 200): number {
  const parsed = parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}
