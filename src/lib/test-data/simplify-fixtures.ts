/**
 * Test fixtures for the debt-simplification algorithm.
 *
 * Each fixture is a self-contained list of transactions (who paid, and each
 * participant's share). These are pure in-memory scenarios — nothing here is
 * ever written to the database, so running the tests never pollutes real data
 * and there is nothing to clean up afterwards.
 *
 * `expectedTransfers`, when set, is the known-optimal number of payments the
 * simplification should produce. When omitted, the runner only checks the
 * structural invariants (money is conserved, no self-payments, count is at
 * most n-1).
 */
import type { SimpleTransaction } from "../simplify";

export interface SimplifyFixture {
  name: string;
  description: string;
  transactions: SimpleTransaction[];
  expectedTransfers?: number;
}

// Short, readable participant ids for the scenarios below.
const A = "A";
const B = "B";
const C = "C";
const D = "D";
const E = "E";

export const SIMPLIFY_FIXTURES: SimplifyFixture[] = [
  {
    name: "single-debt",
    description: "A pays $30, split evenly with B. B owes A $15.",
    transactions: [
      { paidBy: A, participants: [{ userId: A, shareAmount: 15 }, { userId: B, shareAmount: 15 }] },
    ],
    expectedTransfers: 1,
  },
  {
    name: "mutual-cancel",
    description: "A and B each pay $20 split evenly — the debts cancel out.",
    transactions: [
      { paidBy: A, participants: [{ userId: A, shareAmount: 10 }, { userId: B, shareAmount: 10 }] },
      { paidBy: B, participants: [{ userId: A, shareAmount: 10 }, { userId: B, shareAmount: 10 }] },
    ],
    expectedTransfers: 0,
  },
  {
    name: "three-way-cycle",
    description: "A covers B, B covers C, C covers A ($10 each) — a cycle that fully collapses.",
    transactions: [
      { paidBy: A, participants: [{ userId: B, shareAmount: 10 }] },
      { paidBy: B, participants: [{ userId: C, shareAmount: 10 }] },
      { paidBy: C, participants: [{ userId: A, shareAmount: 10 }] },
    ],
    expectedTransfers: 0,
  },
  {
    name: "star-payer",
    description: "A pays $40 for a dinner split 4 ways — 3 people each owe A $10.",
    transactions: [
      {
        paidBy: A,
        participants: [
          { userId: A, shareAmount: 10 },
          { userId: B, shareAmount: 10 },
          { userId: C, shareAmount: 10 },
          { userId: D, shareAmount: 10 },
        ],
      },
    ],
    expectedTransfers: 3,
  },
  {
    name: "chain-collapse",
    description: "A covers B $20, B covers C $20. Net: C owes A — one payment, not two.",
    transactions: [
      { paidBy: A, participants: [{ userId: B, shareAmount: 20 }] },
      { paidBy: B, participants: [{ userId: C, shareAmount: 20 }] },
    ],
    expectedTransfers: 1,
  },
  {
    name: "two-independent-pairs",
    description: "A covers B $15; C covers D $25. Two unrelated debts stay separate.",
    transactions: [
      { paidBy: A, participants: [{ userId: B, shareAmount: 15 }] },
      { paidBy: C, participants: [{ userId: D, shareAmount: 25 }] },
    ],
    expectedTransfers: 2,
  },
  {
    name: "mixed-reduces-to-star",
    description: "A pays $60 (3-way); C then pays $30 (with A). Nets to B and C both owing A.",
    transactions: [
      {
        paidBy: A,
        participants: [
          { userId: A, shareAmount: 20 },
          { userId: B, shareAmount: 20 },
          { userId: C, shareAmount: 20 },
        ],
      },
      { paidBy: C, participants: [{ userId: A, shareAmount: 15 }, { userId: C, shareAmount: 15 }] },
    ],
    expectedTransfers: 2,
  },
  {
    name: "settled-by-repayments",
    description: "A fronts $30 (3-way), then B and C each repay $10 — everyone ends even.",
    transactions: [
      {
        paidBy: A,
        participants: [
          { userId: A, shareAmount: 10 },
          { userId: B, shareAmount: 10 },
          { userId: C, shareAmount: 10 },
        ],
      },
      { paidBy: B, participants: [{ userId: A, shareAmount: 10 }] },
      { paidBy: C, participants: [{ userId: A, shareAmount: 10 }] },
    ],
    expectedTransfers: 0,
  },
  {
    name: "five-people-complex",
    description: "A pays $100 (5-way); E pays $60 (with A and B). Collapses to 3 payments.",
    transactions: [
      {
        paidBy: A,
        participants: [
          { userId: A, shareAmount: 20 },
          { userId: B, shareAmount: 20 },
          { userId: C, shareAmount: 20 },
          { userId: D, shareAmount: 20 },
          { userId: E, shareAmount: 20 },
        ],
      },
      {
        paidBy: E,
        participants: [
          { userId: E, shareAmount: 20 },
          { userId: A, shareAmount: 20 },
          { userId: B, shareAmount: 20 },
        ],
      },
    ],
    expectedTransfers: 3,
  },
  {
    name: "dense-web",
    description: "Six overlapping expenses across five people — a tangled web that simplifies.",
    transactions: [
      {
        paidBy: A,
        participants: [
          { userId: A, shareAmount: 12 },
          { userId: B, shareAmount: 12 },
          { userId: C, shareAmount: 12 },
        ],
      },
      { paidBy: B, participants: [{ userId: C, shareAmount: 18 }, { userId: D, shareAmount: 18 }] },
      { paidBy: C, participants: [{ userId: A, shareAmount: 9 }, { userId: E, shareAmount: 9 }] },
      {
        paidBy: D,
        participants: [
          { userId: D, shareAmount: 7 },
          { userId: A, shareAmount: 7 },
          { userId: B, shareAmount: 7 },
        ],
      },
      { paidBy: E, participants: [{ userId: B, shareAmount: 14 }, { userId: C, shareAmount: 14 }] },
      { paidBy: A, participants: [{ userId: D, shareAmount: 25 }, { userId: E, shareAmount: 25 }] },
      // NOTE: fixtures above deliberately carry no `payers` — they exercise the
      // single-payer fallback, which is what every pre-multi-payer row does.
    ],
    // Non-trivial optimum — left to the invariant checks rather than a hand count.
  },

  // ── Multiple payers ────────────────────────────────────────────────
  {
    name: "two-payers-even-split",
    description:
      "One $100 bill settled across two cards ($60/$40), split evenly four ways \u2014 nets A +35, B +15, C -25, D -25.",
    transactions: [
      {
        paidBy: A, // primary payer, retained for display only
        payers: [
          { userId: A, amountPaid: 60 },
          { userId: B, amountPaid: 40 },
        ],
        participants: [
          { userId: A, shareAmount: 25 },
          { userId: B, shareAmount: 25 },
          { userId: C, shareAmount: 25 },
          { userId: D, shareAmount: 25 },
        ],
      },
    ],
    // Three, not two: nets are {+35, +15} against {-25, -25}, and no debtor's
    // balance matches a creditor's, so one of them has to split their payment.
    expectedTransfers: 3,
  },
  {
    name: "payer-who-owes-nothing",
    description:
      "B fronts half a bill they take no share of \u2014 they end up purely a creditor.",
    transactions: [
      {
        paidBy: A,
        payers: [
          { userId: A, amountPaid: 30 },
          { userId: B, amountPaid: 30 },
        ],
        participants: [
          { userId: C, shareAmount: 30 },
          { userId: D, shareAmount: 30 },
        ],
      },
    ],
    expectedTransfers: 2,
  },
  {
    name: "multi-payer-settles-itself",
    description:
      "Two people each pay exactly what they owe \u2014 no debt should be created at all.",
    transactions: [
      {
        paidBy: A,
        payers: [
          { userId: A, amountPaid: 40 },
          { userId: B, amountPaid: 60 },
        ],
        participants: [
          { userId: A, shareAmount: 40 },
          { userId: B, shareAmount: 60 },
        ],
      },
    ],
    expectedTransfers: 0,
  },
];
