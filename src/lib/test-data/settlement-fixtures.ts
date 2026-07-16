/** Settlement-balance test fixtures. */
export interface SettlementFixture {
  name: string;
  description: string;
  /** Users to insert (first user is "the viewer"). */
  users: { id: string; name: string; email: string }[];
  /** Friendship pairs (two-way edges inserted automatically). */
  friendships: [string, string][];
  /** Transactions: one per entry. */
  transactions: {
    id: string;
    title: string;
    totalAmount: number;
    paidByUserId: string;
    transactionDate: string;
    /** Participants (including payer if they're sharing the cost). */
    participants: { userId: string; shareAmount: number }[];
  }[];
  /** Settlements to insert (settledAt = "PAID" means already paid). */
  settlements: {
    id: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    settledAt: "PAID" | null;
  }[];
  /**
   * Expected per-person balances from `getBalance(viewerId)`:
   * Map of friendId → expected net amount (positive = they owe viewer)
   */
  expectedBalances: Record<string, number>;
}

export const SETTLEMENT_FIXTURES: SettlementFixture[] = [
  {
    name: "simple-debt",
    description: "You paid $100 dinner split 50/50 with Alex. Settle $50 → net zero.",
    users: [
      { id: "user-you", name: "You", email: "you@test.com" },
      { id: "user-alex", name: "Alex", email: "alex@test.com" },
    ],
    friendships: [["user-you", "user-alex"]],
    transactions: [
      {
        id: "tx-dinner",
        title: "Dinner",
        totalAmount: 100,
        paidByUserId: "user-you",
        transactionDate: "2026-07-01",
        participants: [
          { userId: "user-you", shareAmount: 50 },
          { userId: "user-alex", shareAmount: 50 },
        ],
      },
    ],
    settlements: [
      {
        id: "settlement-1",
        fromUserId: "user-alex",
        toUserId: "user-you",
        amount: 50,
        settledAt: "PAID",
      },
    ],
    expectedBalances: {
      "user-alex": 0, // Alex paid in full, no longer owes you
    },
  },
  {
    name: "partial-settle",
    description: "You paid $100 split with Alex 50/50. Alex only paid $20 → still owes $30.",
    users: [
      { id: "user-you", name: "You", email: "you@test.com" },
      { id: "user-alex", name: "Alex", email: "alex@test.com" },
    ],
    friendships: [["user-you", "user-alex"]],
    transactions: [
      {
        id: "tx-dinner",
        title: "Dinner",
        totalAmount: 100,
        paidByUserId: "user-you",
        transactionDate: "2026-07-01",
        participants: [
          { userId: "user-you", shareAmount: 50 },
          { userId: "user-alex", shareAmount: 50 },
        ],
      },
    ],
    settlements: [
      {
        id: "settlement-1",
        fromUserId: "user-alex",
        toUserId: "user-you",
        amount: 20,
        settledAt: "PAID",
      },
    ],
    expectedBalances: {
      "user-alex": 30, // Alex paid $20 of their $50 debt, still owes $30
    },
  },
  {
    name: "over-settle",
    description: "You paid $100 split with Alex 50/50. Alex paid $60 → you owe Alex $10.",
    users: [
      { id: "user-you", name: "You", email: "you@test.com" },
      { id: "user-alex", name: "Alex", email: "alex@test.com" },
    ],
    friendships: [["user-you", "user-alex"]],
    transactions: [
      {
        id: "tx-dinner",
        title: "Dinner",
        totalAmount: 100,
        paidByUserId: "user-you",
        transactionDate: "2026-07-01",
        participants: [
          { userId: "user-you", shareAmount: 50 },
          { userId: "user-alex", shareAmount: 50 },
        ],
      },
    ],
    settlements: [
      {
        id: "settlement-1",
        fromUserId: "user-alex",
        toUserId: "user-you",
        amount: 60,
        settledAt: "PAID",
      },
    ],
    expectedBalances: {
      "user-alex": -10, // Alex overpaid by $10, you owe them $10
    },
  },
  {
    name: "multi-person",
    description: "You paid $150 split 3 ways. Alex paid $50 → Alex owes $0, Ben still owes $50.",
    users: [
      { id: "user-you", name: "You", email: "you@test.com" },
      { id: "user-alex", name: "Alex", email: "alex@test.com" },
      { id: "user-ben", name: "Ben", email: "ben@test.com" },
    ],
    friendships: [
      ["user-you", "user-alex"],
      ["user-you", "user-ben"],
    ],
    transactions: [
      {
        id: "tx-dinner",
        title: "Dinner",
        totalAmount: 150,
        paidByUserId: "user-you",
        transactionDate: "2026-07-01",
        participants: [
          { userId: "user-you", shareAmount: 50 },
          { userId: "user-alex", shareAmount: 50 },
          { userId: "user-ben", shareAmount: 50 },
        ],
      },
    ],
    settlements: [
      {
        id: "settlement-alex",
        fromUserId: "user-alex",
        toUserId: "user-you",
        amount: 50,
        settledAt: "PAID",
      },
    ],
    expectedBalances: {
      "user-alex": 0, // Alex settled in full
      "user-ben": 50, // Ben still owes
    },
  },
  {
    name: "both-directions",
    description: "You paid Alex $20 coffee. Alex paid you $10 lunch. Alex pays $10 → net zero.",
    users: [
      { id: "user-you", name: "You", email: "you@test.com" },
      { id: "user-alex", name: "Alex", email: "alex@test.com" },
    ],
    friendships: [["user-you", "user-alex"]],
    transactions: [
      {
        id: "tx-coffee",
        title: "Coffee",
        totalAmount: 20,
        paidByUserId: "user-you",
        transactionDate: "2026-07-01",
        participants: [{ userId: "user-alex", shareAmount: 20 }],
      },
      {
        id: "tx-lunch",
        title: "Lunch",
        totalAmount: 10,
        paidByUserId: "user-alex",
        transactionDate: "2026-07-01",
        participants: [{ userId: "user-you", shareAmount: 10 }],
      },
    ],
    settlements: [
      {
        id: "settlement-1",
        fromUserId: "user-alex",
        toUserId: "user-you",
        amount: 10,
        settledAt: "PAID",
      },
    ],
    expectedBalances: {
      "user-alex": 0, // Alex owed $20 - $10 = $10, paid $10, net zero
    },
  },
  {
    name: "user-pays-friend",
    description: "You owe Alex $30 from groceries. You pay Alex $30 → net zero.",
    users: [
      { id: "user-you", name: "You", email: "you@test.com" },
      { id: "user-alex", name: "Alex", email: "alex@test.com" },
    ],
    friendships: [["user-you", "user-alex"]],
    transactions: [
      {
        id: "tx-groceries",
        title: "Groceries",
        totalAmount: 30,
        paidByUserId: "user-alex",
        transactionDate: "2026-07-01",
        participants: [{ userId: "user-you", shareAmount: 30 }],
      },
    ],
    settlements: [
      {
        id: "settlement-1",
        fromUserId: "user-you",
        toUserId: "user-alex",
        amount: 30,
        settledAt: "PAID",
      },
    ],
    expectedBalances: {
      "user-alex": 0, // You paid Alex in full
    },
  },
  {
    name: "no-transactions",
    description: "No transactions between friends → net zero.",
    users: [
      { id: "user-you", name: "You", email: "you@test.com" },
      { id: "user-alex", name: "Alex", email: "alex@test.com" },
    ],
    friendships: [["user-you", "user-alex"]],
    transactions: [],
    settlements: [],
    expectedBalances: {
      "user-alex": 0,
    },
  },
  {
    name: "multiple-settlements",
    description: "Multiple settlement payments applied to one debt → correct net.",
    users: [
      { id: "user-you", name: "You", email: "you@test.com" },
      { id: "user-alex", name: "Alex", email: "alex@test.com" },
    ],
    friendships: [["user-you", "user-alex"]],
    transactions: [
      {
        id: "tx-big",
        title: "Big expense",
        totalAmount: 200,
        paidByUserId: "user-you",
        transactionDate: "2026-07-01",
        participants: [
          { userId: "user-you", shareAmount: 100 },
          { userId: "user-alex", shareAmount: 100 },
        ],
      },
    ],
    settlements: [
      {
        id: "settlement-1",
        fromUserId: "user-alex",
        toUserId: "user-you",
        amount: 30,
        settledAt: "PAID",
      },
      {
        id: "settlement-2",
        fromUserId: "user-alex",
        toUserId: "user-you",
        amount: 30,
        settledAt: "PAID",
      },
      {
        id: "settlement-3",
        fromUserId: "user-alex",
        toUserId: "user-you",
        amount: 40,
        settledAt: "PAID",
      },
    ],
    expectedBalances: {
      "user-alex": 0, // Alex paid $30 + $30 + $40 = $100, net zero
    },
  },
];
