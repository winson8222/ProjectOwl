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
    totalAmount: 116.50,
    paidByUserId: "user-you",
    transactionDate: new Date(Date.now() - 86400000 * 2).toISOString().split("T")[0], // 2 days ago
    notes: "Great Japanese food!",
  }).run();

  // Items — descriptive line items only, the split lives on `participants` below
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

  // Split the whole dinner among the four people who shared it
  const sakuraParticipants = [
    { userId: "user-you", amount: 43.50 },
    { userId: "user-alex", amount: 29.50 },
    { userId: "user-ben", amount: 22.50 },
    { userId: "user-chloe", amount: 21.00 },
  ];

  for (const p of sakuraParticipants) {
    db.insert(schema.participants).values({
      id: uuid(),
      transactionId: txId,
      userId: p.userId,
      shareAmount: p.amount,
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
    db.insert(schema.participants).values({
      id: uuid(),
      transactionId: txId2,
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
