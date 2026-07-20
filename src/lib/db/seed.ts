import type { Db } from "./index";
import * as schema from "./schema";
import { v4 as uuid } from "uuid";

/**
 * Seed the database with sample users, groups, and per-group transactions.
 * Only runs if the users table is empty. Returns true when data was inserted.
 *
 * Not called at connection time — run explicitly via `npm run db:seed` or the
 * dev-only debug reset endpoint.
 */
export async function seed(db: Db): Promise<boolean> {
  const existing = await db.select().from(schema.users);
  if (existing.length > 0) return false; // already seeded

  // ── Users ──────────────────────────────────────────────────────────
  const allUsers = [
    { id: "user-you", name: "You", email: "you@projectowl.app" },
    { id: "user-alex", name: "Alex", email: "alex@example.com" },
    { id: "user-ben", name: "Ben", email: "ben@example.com" },
    { id: "user-chloe", name: "Chloe", email: "chloe@example.com" },
    { id: "user-diana", name: "Diana", email: "diana@example.com" },
  ];
  for (const u of allUsers) {
    await db.insert(schema.users).values({ ...u, avatarUrl: null });
  }

  // Friendships (two-way, everyone knows everyone — legacy table kept for compat)
  for (let i = 0; i < allUsers.length; i++) {
    for (let j = i + 1; j < allUsers.length; j++) {
      await db.insert(schema.friendships).values({ id: uuid(), userId: allUsers[i].id, friendId: allUsers[j].id });
      await db.insert(schema.friendships).values({ id: uuid(), userId: allUsers[j].id, friendId: allUsers[i].id });
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────
  const daysAgo = (n: number, hour = 12): string => {
    const d = new Date(Date.now() - 86400000 * n);
    d.setHours(hour, 0, 0, 0);
    const pad = (x: number) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00:00`;
  };
  const dateOnly = (n: number): string =>
    new Date(Date.now() - 86400000 * n).toISOString().split("T")[0];

  const createGroup = async (id: string, name: string, color: string, creator: string, memberIds: string[], createdDaysAgo: number) => {
    await db.insert(schema.groups).values({
      id, name, color, createdByUserId: creator, createdAt: daysAgo(createdDaysAgo, 9),
    });
    for (const userId of memberIds) {
      await db.insert(schema.groupMembers).values({
        id: `gm-${uuid().slice(0, 8)}`, groupId: id, userId, createdAt: daysAgo(createdDaysAgo, 9),
      });
    }
    await db.insert(schema.activities).values({
      id: `act-${uuid().slice(0, 12)}`, type: "group_created", userId: creator,
      groupId: id, createdAt: daysAgo(createdDaysAgo, 9),
    });
  };

  const createTx = async (opts: {
    id: string; groupId: string; title: string; total: number; paidBy: string;
    ageDays: number;
    items?: { name: string; quantity: number; price: number }[];
    split: { userId: string; amount: number }[];
  }) => {
    await db.insert(schema.transactions).values({
      id: opts.id,
      title: opts.title,
      totalAmount: opts.total,
      paidByUserId: opts.paidBy,
      groupId: opts.groupId,
      transactionDate: dateOnly(opts.ageDays),
      createdAt: daysAgo(opts.ageDays, 18),
    });
    for (const item of opts.items ?? [{ name: opts.title, quantity: 1, price: opts.total }]) {
      await db.insert(schema.transactionItems).values({
        id: `item-${uuid().slice(0, 8)}`, transactionId: opts.id, ...item,
      });
    }
    for (const p of opts.split) {
      await db.insert(schema.participants).values({
        id: uuid(), transactionId: opts.id, userId: p.userId, shareAmount: p.amount,
      });
    }
    await db.insert(schema.activities).values({
      id: `act-${uuid().slice(0, 12)}`, type: "transaction", userId: opts.paidBy,
      amount: opts.total, groupId: opts.groupId, transactionId: opts.id,
      createdAt: daysAgo(opts.ageDays, 18),
    });
  };

  // ── Group 1: Itrenia Main Club (everyone) ──────────────────────────
  await createGroup("group-itrenia", "Itrenia Main Club", "#f87171", "user-you",
    ["user-you", "user-alex", "user-ben", "user-chloe", "user-diana"], 10);

  await createTx({
    id: "tx-demo-sakura", groupId: "group-itrenia",
    title: "Dinner at Sakura", total: 116.50, paidBy: "user-you", ageDays: 3,
    items: [
      { name: "Sushi Platter", quantity: 1, price: 42.00 },
      { name: "Ramen", quantity: 2, price: 28.00 },
      { name: "Gyoza", quantity: 1, price: 12.50 },
      { name: "Green Tea", quantity: 4, price: 16.00 },
      { name: "Service Charge", quantity: 1, price: 18.00 },
    ],
    split: [
      { userId: "user-you", amount: 43.50 },
      { userId: "user-alex", amount: 29.50 },
      { userId: "user-ben", amount: 22.50 },
      { userId: "user-chloe", amount: 21.00 },
    ],
  });

  await createTx({
    id: "tx-demo-karaoke", groupId: "group-itrenia",
    title: "Karaoke Night", total: 80.00, paidBy: "user-ben", ageDays: 2,
    split: [
      { userId: "user-you", amount: 16.00 },
      { userId: "user-alex", amount: 16.00 },
      { userId: "user-ben", amount: 16.00 },
      { userId: "user-chloe", amount: 16.00 },
      { userId: "user-diana", amount: 16.00 },
    ],
  });

  // ── Group 2: Roommates (You, Alex, Ben) ────────────────────────────
  await createGroup("group-roommates", "Roommates", "#60a5fa", "user-alex",
    ["user-you", "user-alex", "user-ben"], 8);

  await createTx({
    id: "tx-demo-groceries", groupId: "group-roommates",
    title: "Weekly Groceries", total: 62.40, paidBy: "user-alex", ageDays: 4,
    split: [
      { userId: "user-you", amount: 20.80 },
      { userId: "user-alex", amount: 20.80 },
      { userId: "user-ben", amount: 20.80 },
    ],
  });

  await createTx({
    id: "tx-demo-internet", groupId: "group-roommates",
    title: "Internet Bill", total: 45.00, paidBy: "user-you", ageDays: 1,
    split: [
      { userId: "user-you", amount: 15.00 },
      { userId: "user-alex", amount: 15.00 },
      { userId: "user-ben", amount: 15.00 },
    ],
  });

  // ── Group 3: Japan Trip (You, Chloe, Diana) ────────────────────────
  await createGroup("group-japan", "Japan Trip", "#fbbf24", "user-chloe",
    ["user-you", "user-chloe", "user-diana"], 6);

  await createTx({
    id: "tx-demo-airbnb", groupId: "group-japan",
    title: "Osaka Airbnb", total: 240.00, paidBy: "user-chloe", ageDays: 5,
    split: [
      { userId: "user-you", amount: 80.00 },
      { userId: "user-chloe", amount: 80.00 },
      { userId: "user-diana", amount: 80.00 },
    ],
  });

  await createTx({
    id: "tx-demo-ramen-street", groupId: "group-japan",
    title: "Ramen Street", total: 36.00, paidBy: "user-you", ageDays: 4,
    split: [
      { userId: "user-you", amount: 12.00 },
      { userId: "user-chloe", amount: 12.00 },
      { userId: "user-diana", amount: 12.00 },
    ],
  });

  return true;
}
