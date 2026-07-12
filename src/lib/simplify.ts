/**
 * Debt simplification — pure, dependency-free.
 *
 * Ported from oss-apps/split-pro's `src/lib/simplify.ts` idea (a greedy
 * "minimize cash flow" algorithm), adapted to ProjectOwl's single-currency,
 * string-userId, dollar-amount model.
 *
 * This file intentionally imports NOTHING from the database or Next.js so it
 * can be exercised directly by unit tests / a CLI without a running server or
 * any data being persisted.
 */

/** A minimal view of a transaction: who paid, and each participant's share. */
export interface SimpleTransaction {
  paidBy: string;
  participants: { userId: string; shareAmount: number }[];
}

/** Net position of one user. Positive = they are owed money (creditor);
 *  negative = they owe money (debtor). The sum across all users is ~0. */
export interface NetBalance {
  userId: string;
  amount: number;
}

/** One payment in a settlement plan: `from` (debtor) pays `to` (creditor). */
export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/** Half a cent — anything smaller is treated as zero (float noise). */
export const EPSILON = 0.005;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Collapse a list of transactions into each user's net balance.
 *
 * For every participant who is NOT the payer, that participant owes the payer
 * their share. The payer's own participant row (their share of what they paid
 * for) creates no debt — you can't owe yourself.
 */
export function computeNetBalances(transactions: SimpleTransaction[]): NetBalance[] {
  const net = new Map<string, number>();
  const bump = (userId: string, delta: number) =>
    net.set(userId, (net.get(userId) ?? 0) + delta);

  for (const tx of transactions) {
    for (const p of tx.participants) {
      if (p.userId === tx.paidBy) continue; // can't owe yourself
      bump(p.userId, -p.shareAmount); // participant owes the payer
      bump(tx.paidBy, p.shareAmount); // payer is owed
    }
  }

  return [...net.entries()]
    .map(([userId, amount]) => ({ userId, amount: round2(amount) }))
    .filter((b) => Math.abs(b.amount) > EPSILON);
}

/**
 * Greedy minimum-cash-flow: repeatedly settle the largest creditor against the
 * largest debtor. Produces at most (n-1) transfers for n non-zero balances,
 * which is optimal or near-optimal for the small friend-group sizes this app
 * deals with. This is the same approach documented in Splitwise's engineering
 * blog and used by split-pro.
 */
export function minimizeTransfers(balances: NetBalance[]): Transfer[] {
  // Work on a mutable copy, rounded to cents, dropping already-settled users.
  const nodes = balances
    .map((b) => ({ userId: b.userId, amount: round2(b.amount) }))
    .filter((b) => Math.abs(b.amount) > EPSILON);

  const transfers: Transfer[] = [];

  // Each iteration zeroes at least one node, so n+1 iterations is a safe cap.
  let guard = nodes.length + 1;
  while (guard-- > 0) {
    let creditor = -1;
    let debtor = -1;
    for (let i = 0; i < nodes.length; i++) {
      if (creditor === -1 || nodes[i].amount > nodes[creditor].amount) creditor = i;
      if (debtor === -1 || nodes[i].amount < nodes[debtor].amount) debtor = i;
    }
    if (creditor === -1 || debtor === -1) break;

    const credit = nodes[creditor].amount; // largest positive
    const debit = nodes[debtor].amount; // largest negative (most negative)
    if (credit <= EPSILON || debit >= -EPSILON) break; // nothing left to settle

    const amount = round2(Math.min(credit, -debit));
    nodes[creditor].amount = round2(credit - amount);
    nodes[debtor].amount = round2(debit + amount);

    transfers.push({
      from: nodes[debtor].userId, // debtor pays
      to: nodes[creditor].userId, // creditor receives
      amount,
    });
  }

  return transfers;
}

/** Convenience: transactions → minimal settlement plan in one call. */
export function simplify(transactions: SimpleTransaction[]): Transfer[] {
  return minimizeTransfers(computeNetBalances(transactions));
}
