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

/** A minimal view of a transaction: who put money in, and what each person owes. */
export interface SimpleTransaction {
  /** Primary payer. Retained for display and as the fallback when `payers`
   *  is absent (pre-multi-payer data, and fixtures that predate it). */
  paidBy: string;
  /** Everyone who contributed. When omitted, `paidBy` is treated as having
   *  paid the whole total — which is exactly what it used to mean. */
  payers?: { userId: string; amountPaid: number }[];
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
 * Everyone who put money into a transaction.
 *
 * Falls back to "the primary payer covered the whole total" when a transaction
 * carries no explicit payer rows, which is how every transaction created before
 * multi-payer behaves.
 */
function payersOf(tx: SimpleTransaction): { userId: string; amountPaid: number }[] {
  if (tx.payers && tx.payers.length > 0) return tx.payers;
  const total = tx.participants.reduce((s, p) => s + p.shareAmount, 0);
  return [{ userId: tx.paidBy, amountPaid: total }];
}

/**
 * Who owes whom, from one user's point of view: `otherUserId → amount`, where
 * positive means they owe the viewer and negative means the viewer owes them.
 *
 * With several contributors a share is owed to each of them in proportion to
 * what they put in — a $25 share of a bill where Alex paid $60 and Ben $40 is
 * $15 owed to Alex and $10 to Ben. For a single payer the proportion is 1 and
 * this reduces to "every participant owes the payer their share".
 *
 * Lives here, pure and shared, because this logic previously existed in three
 * separate copies (getBalance, getGroupPage, and the net computation). Two of
 * them were never updated for multiple payers, so the group page told a
 * creditor they were a debtor. One implementation, one place to be wrong.
 */
export function pairwiseFor(
  transactions: SimpleTransaction[],
  viewerId: string
): Map<string, number> {
  const pairwise = new Map<string, number>();
  const bump = (otherId: string, delta: number) =>
    pairwise.set(otherId, (pairwise.get(otherId) ?? 0) + delta);

  for (const tx of transactions) {
    const payers = payersOf(tx);
    const contributed = payers.reduce((s, q) => s + q.amountPaid, 0);
    if (contributed <= 0) continue;

    for (const p of tx.participants) {
      for (const q of payers) {
        if (p.userId === q.userId) continue; // can't owe yourself
        const owed = p.shareAmount * (q.amountPaid / contributed);
        if (q.userId === viewerId) bump(p.userId, owed);
        else if (p.userId === viewerId) bump(q.userId, -owed);
      }
    }
  }

  return pairwise;
}

/**
 * Collapse a list of transactions into each user's net balance.
 *
 * Net = what you put in, minus what you owe.
 *
 * This replaced a formulation that credited the payer with each non-payer's
 * share and skipped the payer's own row ("you can't owe yourself"). The two are
 * arithmetically identical for a single payer — they credit `total − ownShare`
 * either way — but paid-minus-owed generalises to several contributors and
 * needs no self-reference special case.
 */
export function computeNetBalances(transactions: SimpleTransaction[]): NetBalance[] {
  const net = new Map<string, number>();
  const bump = (userId: string, delta: number) =>
    net.set(userId, (net.get(userId) ?? 0) + delta);

  for (const tx of transactions) {
    for (const q of payersOf(tx)) bump(q.userId, q.amountPaid); // put in
    for (const p of tx.participants) bump(p.userId, -p.shareAmount); // owes
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
