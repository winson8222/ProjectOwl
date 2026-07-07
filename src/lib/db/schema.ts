import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

// ── Users ────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// ── Friendships (two-way edges) ──────────────────────────────────────
export const friendships = sqliteTable("friendships", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  friendId: text("friend_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// ── Transactions ─────────────────────────────────────────────────────
export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  totalAmount: real("total_amount").notNull(),
  paidByUserId: text("paid_by_user_id").notNull().references(() => users.id),
  transactionDate: text("transaction_date").notNull(),
  notes: text("notes"),
  receiptImage: text("receipt_image"), // base64 or path
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

// ── Transaction Items (line items from scan or manual) ──────────────
export const transactionItems = sqliteTable("transaction_items", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  price: real("price").notNull(),
  category: text("category"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// ── Item Assignments (who gets how much of an item) ─────────────────
// One row = one user's share of one item. Multiple rows per item = shared item.
export const itemAssignments = sqliteTable("item_assignments", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull().references(() => transactionItems.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  shareAmount: real("share_amount").notNull(), // dollar amount of this share
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// ── Settlements ─────────────────────────────────────────────────────
export const settlements = sqliteTable("settlements", {
  id: text("id").primaryKey(),
  fromUserId: text("from_user_id").notNull().references(() => users.id),
  toUserId: text("to_user_id").notNull().references(() => users.id),
  transactionId: text("transaction_id").references(() => transactions.id),
  amount: real("amount").notNull(),
  settledAt: text("settled_at"), // null = pending, set = paid
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});
