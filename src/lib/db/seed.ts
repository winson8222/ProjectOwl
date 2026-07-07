import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

/**
 * Seed the database with sample users and friendships.
 * Only runs if the users table is empty.
 */
export function seed(db: BetterSQLite3Database<typeof schema>) {
  const existing = db.select().from(schema.users).all();
  if (existing.length > 0) return; // already seeded

  const you = {
    id: "user-you",
    name: "You",
    email: "you@projectowl.app",
    avatarUrl: null,
  };

  const friends = [
    { id: "user-alex", name: "Alex", email: "alex@example.com" },
    { id: "user-ben", name: "Ben", email: "ben@example.com" },
    { id: "user-chloe", name: "Chloe", email: "chloe@example.com" },
    { id: "user-diana", name: "Diana", email: "diana@example.com" },
  ];

  // Insert users
  db.insert(schema.users).values(you).run();
  for (const f of friends) {
    db.insert(schema.users).values({ ...f, avatarUrl: null }).run();
  }

  // Create friendships (two-way)
  for (const f of friends) {
    db.insert(schema.friendships).values({
      id: uuid(),
      userId: you.id,
      friendId: f.id,
    }).run();
    db.insert(schema.friendships).values({
      id: uuid(),
      userId: f.id,
      friendId: you.id,
    }).run();
  }

  // Also friend Alex and Ben together (for group scenarios)
  db.insert(schema.friendships).values({
    id: uuid(),
    userId: "user-alex",
    friendId: "user-ben",
  }).run();
  db.insert(schema.friendships).values({
    id: uuid(),
    userId: "user-ben",
    friendId: "user-alex",
  }).run();

  // ── Seed a sample transaction: Dinner at Sakura ─────────────────
  const txId = "tx-demo-sakura";
  db.insert(schema.transactions).values({
    id: txId,
    title: "Dinner at Sakura",
    totalAmount: 126.50,
    paidByUserId: "user-you",
    transactionDate: new Date(Date.now() - 86400000 * 2).toISOString().split("T")[0], // 2 days ago
    notes: "Great Japanese food!",
  }).run();

  // Items
  const items = [
    { id: "item-1", name: "Sushi Platter", quantity: 1, price: 42.00 },
    { id: "item-2", name: "Ramen", quantity: 2, price: 28.00 },
    { id: "item-3", name: "Gyoza", quantity: 1, price: 12.50 },
    { id: "item-4", name: "Green Tea", quantity: 4, price: 16.00 },
    { id: "item-5", name: "Service Charge", quantity: 1, price: 18.00 },
  ];

  for (const item of items) {
    db.insert(schema.transactionItems).values({
      id: item.id,
      transactionId: txId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    }).run();
  }

  // Assign items to people
  const assignments = [
    // Sushi Platter: shared by You + Alex
    { itemId: "item-1", userId: "user-you", amount: 21.00 },
    { itemId: "item-1", userId: "user-alex", amount: 21.00 },
    // Ramen x2: one each for You and Ben
    { itemId: "item-2", userId: "user-you", amount: 14.00 },
    { itemId: "item-2", userId: "user-ben", amount: 14.00 },
    // Gyoza: Chloe
    { itemId: "item-3", userId: "user-chloe", amount: 12.50 },
    // Green Tea x4: one each
    { itemId: "item-4", userId: "user-you", amount: 4.00 },
    { itemId: "item-4", userId: "user-alex", amount: 4.00 },
    { itemId: "item-4", userId: "user-ben", amount: 4.00 },
    { itemId: "item-4", userId: "user-chloe", amount: 4.00 },
    // Service Charge: split evenly among all four
    { itemId: "item-5", userId: "user-you", amount: 4.50 },
    { itemId: "item-5", userId: "user-alex", amount: 4.50 },
    { itemId: "item-5", userId: "user-ben", amount: 4.50 },
    { itemId: "item-5", userId: "user-chloe", amount: 4.50 },
  ];

  for (const a of assignments) {
    db.insert(schema.itemAssignments).values({
      id: uuid(),
      itemId: a.itemId,
      userId: a.userId,
      shareAmount: a.amount,
    }).run();
  }

  // ── Seed a second transaction: Coffee Run (paid by Alex) ────────
  const txId2 = "tx-demo-coffee";
  db.insert(schema.transactions).values({
    id: txId2,
    title: "Coffee Run",
    totalAmount: 18.50,
    paidByUserId: "user-alex",
    transactionDate: new Date(Date.now() - 86400000).toISOString().split("T")[0], // 1 day ago
  }).run();

  db.insert(schema.transactionItems).values({
    id: "item-coffee-1",
    transactionId: txId2,
    name: "Coffee Run",
    quantity: 1,
    price: 18.50,
  }).run();

  // Split evenly among You, Alex, Ben
  for (const uid of ["user-you", "user-alex", "user-ben"]) {
    db.insert(schema.itemAssignments).values({
      id: uuid(),
      itemId: "item-coffee-1",
      userId: uid,
      shareAmount: 6.17,
    }).run();
  }

  // ── Seed a settlement: You owe Alex for coffee ─────────────────
  db.insert(schema.settlements).values({
    id: "settlement-demo-1",
    fromUserId: "user-you",
    toUserId: "user-alex",
    transactionId: txId2,
    amount: 6.17,
    // settledAt left null = pending
  }).run();
}
