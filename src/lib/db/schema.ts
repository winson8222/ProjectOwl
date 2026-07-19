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

// ── Groups ───────────────────────────────────────────────────────────
// A group is a set of users who share expenses. Users can belong to many
// groups, and every transaction belongs to exactly one group (enforced at
// the API layer — the column stays nullable so legacy rows/tests still load).
export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color"), // hex color for the group's avatar circle
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// ── Group Members (user ↔ group edges) ──────────────────────────────
export const groupMembers = sqliteTable("group_members", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// ── Activities (feed of everything that happens in a group) ─────────
// type: "transaction" | "settlement" | "group_created" | "member_added"
export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  userId: text("user_id").notNull().references(() => users.id), // the actor
  relatedUserId: text("related_user_id").references(() => users.id), // e.g. settlement recipient, added member
  amount: real("amount"), // dollar amount when relevant
  groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  transactionId: text("transaction_id").references(() => transactions.id),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// ── Transactions ─────────────────────────────────────────────────────
export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  // "expense" = a shared cost split between participants.
  // "payment" = a direct user→user payment: paid_by pays the sole
  // participant, which reduces what the payer owes them.
  type: text("type").notNull().default("expense"),
  totalAmount: real("total_amount").notNull(),
  paidByUserId: text("paid_by_user_id").notNull().references(() => users.id),
  groupId: text("group_id").references(() => groups.id), // nullable in DB, required by the API
  transactionDate: text("transaction_date").notNull(),
  notes: text("notes"),
  receiptImage: text("receipt_image"), // base64 or path
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false), // soft delete — row kept for ledger history
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

// ── Participants (who owes how much of a transaction) ────────────────
// One row = one user's share of a transaction's total. Items are descriptive
// line items only — splitting happens once, at the transaction level.
export const participants = sqliteTable("participants", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  shareAmount: real("share_amount").notNull(), // dollar amount of this share
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// ── Item Assignments (scan-based: which user gets which item) ──────
// Links a transaction line item to the users who share it, and how much
// of that item's price each user owes. This is the *raw* scan allocation,
// stored separately from participants so the final edited split can differ.
export const itemAssignments = sqliteTable("item_assignments", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull().references(() => transactionItems.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  shareAmount: real("share_amount").notNull(), // this user's portion of this item's price
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

// ── Settlements ─────────────────────────────────────────────────────
export const settlements = sqliteTable("settlements", {
  id: text("id").primaryKey(),
  fromUserId: text("from_user_id").notNull().references(() => users.id),
  toUserId: text("to_user_id").notNull().references(() => users.id),
  transactionId: text("transaction_id").references(() => transactions.id),
  groupId: text("group_id").references(() => groups.id), // group this payment settles (nullable for legacy rows)
  amount: real("amount").notNull(),
  settledAt: text("settled_at"), // null = pending, set = paid
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});
