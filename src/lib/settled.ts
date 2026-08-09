/**
 * Is a balance genuinely square?
 *
 * NOT `netBalance === 0`. netBalance is a net: owe Alex $50 and be owed $50 by
 * Ben and it reads zero while two live debts sit open — stamping that PAID
 * would be a lie. Both gross sides have to be clear.
 *
 * Epsilon rather than an exact compare because money is stored as
 * doublePrecision (noted as known debt in the Devlog), so summed floats don't
 * land exactly on zero.
 */
const CENT = 0.01;

export function isSettled(balance?: {
  totalOwed?: number;
  totalOwe?: number;
} | null): boolean {
  if (!balance) return false;
  return (
    Math.abs(balance.totalOwed ?? 0) < CENT && Math.abs(balance.totalOwe ?? 0) < CENT
  );
}

/**
 * Net zero, but with debts open in both directions — one transfer from done.
 * Worth saying so rather than showing the same blank card as a settled user.
 */
export function isNetZeroButOpen(balance?: {
  netBalance?: number;
  totalOwed?: number;
  totalOwe?: number;
} | null): boolean {
  if (!balance) return false;
  return Math.abs(balance.netBalance ?? 0) < CENT && !isSettled(balance);
}
