import { pgTable, text, doublePrecision, integer, boolean, index, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Timestamps are stored as TEXT ("YYYY-MM-DD HH:MM:SS", UTC) to match the
// SQLite-era format — the app string-sorts createdAt and writes explicit
// values via localTimestamp(). The default mirrors SQLite's CURRENT_TIMESTAMP.
const textTimestamp = () =>
  sql`to_char(timezone('utc', now()), 'YYYY-MM-DD HH24:MI:SS')`;

// ── Users ────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  // Supabase auth identity (auth.users.id UUID). Nullable: seeded/mock users
  // and legacy rows have no auth identity; set on first OAuth sign-in.
  authId: uuid("auth_id").unique(),
  createdAt: text("created_at").default(textTimestamp()).notNull(),
});

// ── Friendships (two-way edges) ──────────────────────────────────────
export const friendships = pgTable("friendships", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  friendId: text("friend_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at").default(textTimestamp()).notNull(),
});

// ── Groups ───────────────────────────────────────────────────────────
// A group is a set of users who share expenses. Users can belong to many
// groups, and every transaction belongs to exactly one group (enforced at
// the API layer — the column stays nullable so legacy rows/tests still load).
export const groups = pgTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color"), // hex color for the group's avatar circle
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
  createdAt: text("created_at").default(textTimestamp()).notNull(),
  displayOrder: integer("display_order").default(0).notNull(), // for custom ordering in UI
});

// ── Group Members (user ↔ group edges) ──────────────────────────────
export const groupMembers = pgTable("group_members", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at").default(textTimestamp()).notNull(),
}, (t) => [
  index("idx_group_members_group").on(t.groupId),
  index("idx_group_members_user").on(t.userId),
]);

// ── Group Invites (shareable join links) ────────────────────────────
// A token is the whole credential: anyone who has it and is signed in can
// join the group via /join/[token]. No acceptance flow — joining is the
// invitee's own action. expiresAt null = never expires.
export const groupInvites = pgTable("group_invites", {
  token: text("token").primaryKey(),
  groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
  expiresAt: text("expires_at"), // same TEXT timestamp format as createdAt
  createdAt: text("created_at").default(textTimestamp()).notNull(),
}, (t) => [
  index("idx_group_invites_group").on(t.groupId),
]);

// ── Activities (feed of everything that happens in a group) ─────────
// type: "transaction" | "settlement" | "group_created" | "member_added"
export const activities = pgTable("activities", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  userId: text("user_id").notNull().references(() => users.id), // the actor
  relatedUserId: text("related_user_id").references(() => users.id), // e.g. settlement recipient, added member
  amount: doublePrecision("amount"), // dollar amount when relevant
  groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  transactionId: text("transaction_id").references(() => transactions.id),
  createdAt: text("created_at").default(textTimestamp()).notNull(),
}, (t) => [
  index("idx_activities_group").on(t.groupId),
  index("idx_activities_created").on(t.createdAt),
]);

// ── Transactions ─────────────────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  // "expense" = a shared cost split between participants.
  // "payment" = a direct user→user payment: paid_by pays the sole
  // participant, which reduces what the payer owes them.
  type: text("type").notNull().default("expense"),
  totalAmount: doublePrecision("total_amount").notNull(),
  paidByUserId: text("paid_by_user_id").notNull().references(() => users.id),
  groupId: text("group_id").references(() => groups.id), // nullable in DB, required by the API
  transactionDate: text("transaction_date").notNull(),
  notes: text("notes"),
  receiptImage: text("receipt_image"), // base64 or path
  createdAt: text("created_at").default(textTimestamp()).notNull(),
  updatedAt: text("updated_at").default(textTimestamp()).notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false), // soft delete — row kept for ledger history
}, (t) => [
  index("idx_transactions_paid_by").on(t.paidByUserId),
  index("idx_transactions_date").on(t.transactionDate),
  index("idx_transactions_group").on(t.groupId),
  index("idx_transactions_is_deleted").on(t.isDeleted),
]);

// ── Transaction Items (line items from scan or manual) ──────────────
export const transactionItems = pgTable("transaction_items", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  price: doublePrecision("price").notNull(),
  category: text("category"),
  createdAt: text("created_at").default(textTimestamp()).notNull(),
}, (t) => [
  index("idx_items_transaction").on(t.transactionId),
]);

// ── Participants (who owes how much of a transaction) ────────────────
// One row = one user's share of a transaction's total. Items are descriptive
// line items only — splitting happens once, at the transaction level.
export const participants = pgTable("participants", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  shareAmount: doublePrecision("share_amount").notNull(), // dollar amount of this share
  createdAt: text("created_at").default(textTimestamp()).notNull(),
}, (t) => [
  index("idx_participants_transaction").on(t.transactionId),
  index("idx_participants_user").on(t.userId),
]);

// ── Item Assignments (scan-based: which user gets which item) ──────
// Links a transaction line item to the users who share it, and how much
// of that item's price each user owes. This is the *raw* scan allocation,
// stored separately from participants so the final edited split can differ.
export const itemAssignments = pgTable("item_assignments", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull().references(() => transactionItems.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  shareAmount: doublePrecision("share_amount").notNull(), // this user's portion of this item's price
  createdAt: text("created_at").default(textTimestamp()).notNull(),
}, (t) => [
  index("idx_item_assignments_item").on(t.itemId),
  index("idx_item_assignments_user").on(t.userId),
]);

// ── Settlements ─────────────────────────────────────────────────────
export const settlements = pgTable("settlements", {
  id: text("id").primaryKey(),
  fromUserId: text("from_user_id").notNull().references(() => users.id),
  toUserId: text("to_user_id").notNull().references(() => users.id),
  transactionId: text("transaction_id").references(() => transactions.id),
  groupId: text("group_id").references(() => groups.id), // group this payment settles (nullable for legacy rows)
  amount: doublePrecision("amount").notNull(),
  settledAt: text("settled_at"), // null = pending, "PAID" = paid
  createdAt: text("created_at").default(textTimestamp()).notNull(),
}, (t) => [
  index("idx_settlements_from").on(t.fromUserId),
  index("idx_settlements_to").on(t.toUserId),
  index("idx_settlements_group").on(t.groupId),
]);
