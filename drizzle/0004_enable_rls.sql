-- =============================================================================
-- Enable Row Level Security on all application tables
-- =============================================================================
-- Policies are scoped to the authenticated role.  The service_role and postgres
-- roles bypass RLS automatically, so the existing server-side API (which
-- connects with DATABASE_URL) continues to work unchanged.
--
-- When the app is ready to enforce RLS per-request, call
--   SELECT set_config('request.jwt.claims', '{"sub":"<auth.users.id uuid>"}', true);
--   SELECT set_config('role', 'authenticated', true);
-- before queries.  See src/lib/db/rls.ts for the helper.
-- =============================================================================

-- ── Helper: app user id from the Supabase auth JWT ─────────────────────────
-- auth.uid()  →  auth.users.id (UUID)
-- users.auth_id = auth.uid()  →  the corresponding row in the app users table
-- Most policies reference  app_user_id()  to scope access.

-- ── users ───────────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read every profile (names & avatars need to be
-- visible in group contexts).
CREATE POLICY "users_select" ON users
  FOR SELECT
  USING (true);

-- Users can only update their own profile row.
CREATE POLICY "users_update" ON users
  FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- OAuth sign-up creates the user row with the caller's auth.users.id.
CREATE POLICY "users_insert" ON users
  FOR INSERT
  WITH CHECK (auth_id = auth.uid());

-- ── friendships ─────────────────────────────────────────────────────────────
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- You can see friendships where you are either party.
CREATE POLICY "friendships_select" ON friendships
  FOR SELECT
  USING (
    user_id  = (SELECT id FROM users WHERE auth_id = auth.uid())
    OR
    friend_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- You can only create a friendship pointing at yourself.
CREATE POLICY "friendships_insert" ON friendships
  FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- You can delete your own friendships.
CREATE POLICY "friendships_delete" ON friendships
  FOR DELETE
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- ── groups ──────────────────────────────────────────────────────────────────
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Members can see groups they belong to.
CREATE POLICY "groups_select" ON groups
  FOR SELECT
  USING (
    id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Any authenticated user can create a group (they auto-join as creator).
CREATE POLICY "groups_insert" ON groups
  FOR INSERT
  WITH CHECK (true);

-- Only group members can update the group.
CREATE POLICY "groups_update" ON groups
  FOR UPDATE
  USING (
    id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Only group members can delete the group.
CREATE POLICY "groups_delete" ON groups
  FOR DELETE
  USING (
    id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- ── group_members ───────────────────────────────────────────────────────────
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- You can see the member list of any group you belong to.
CREATE POLICY "group_members_select" ON group_members
  FOR SELECT
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Existing members can add new members to a group.
CREATE POLICY "group_members_insert" ON group_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Existing members can remove members from a group.
CREATE POLICY "group_members_delete" ON group_members
  FOR DELETE
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- ── group_invites ───────────────────────────────────────────────────────────
ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;

-- Group members can see invites for their groups.
CREATE POLICY "group_invites_select" ON group_invites
  FOR SELECT
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Group members can create invite links.
CREATE POLICY "group_invites_insert" ON group_invites
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_invites.group_id
        AND gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Group members can delete invite links.
CREATE POLICY "group_invites_delete" ON group_invites
  FOR DELETE
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- ── activities ──────────────────────────────────────────────────────────────
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- You can see the activity feed for any group you belong to.
CREATE POLICY "activities_select" ON activities
  FOR SELECT
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Activities are only created server-side (no direct client inserts).
-- INSERT / UPDATE / DELETE are intentionally left without policies so they
-- fall through to the service_role only.

-- ── transactions ────────────────────────────────────────────────────────────
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Members can see transactions belonging to their groups.
-- Transactions with a null group_id (legacy rows) are visible to the payer
-- and any participant.
CREATE POLICY "transactions_select" ON transactions
  FOR SELECT
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
    OR (
      group_id IS NULL
      AND (
        paid_by_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
        OR id IN (
          SELECT p.transaction_id FROM participants p
          WHERE p.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
        )
      )
    )
  );

-- Group members can create transactions in their groups.
CREATE POLICY "transactions_insert" ON transactions
  FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Group members can update transactions in their groups.
CREATE POLICY "transactions_update" ON transactions
  FOR UPDATE
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Group members can (soft-)delete transactions in their groups.
CREATE POLICY "transactions_delete" ON transactions
  FOR DELETE
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- ── transaction_items ───────────────────────────────────────────────────────
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

-- Visible when the parent transaction is visible.
CREATE POLICY "transaction_items_select" ON transaction_items
  FOR SELECT
  USING (
    transaction_id IN (
      SELECT t.id FROM transactions t
      WHERE t.group_id IN (
        SELECT gm.group_id FROM group_members gm
        WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
      )
    )
  );

-- INSERT / UPDATE / DELETE are server-side only.

-- ── participants ────────────────────────────────────────────────────────────
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

-- Visible when the parent transaction is visible.
CREATE POLICY "participants_select" ON participants
  FOR SELECT
  USING (
    transaction_id IN (
      SELECT t.id FROM transactions t
      WHERE t.group_id IN (
        SELECT gm.group_id FROM group_members gm
        WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
      )
    )
  );

-- Group members can insert participants into their groups' transactions.
CREATE POLICY "participants_insert" ON participants
  FOR INSERT
  WITH CHECK (
    transaction_id IN (
      SELECT t.id FROM transactions t
      WHERE t.group_id IN (
        SELECT gm.group_id FROM group_members gm
        WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
      )
    )
  );

-- ── item_assignments ────────────────────────────────────────────────────────
ALTER TABLE item_assignments ENABLE ROW LEVEL SECURITY;

-- Visible when the parent item → transaction is visible.
CREATE POLICY "item_assignments_select" ON item_assignments
  FOR SELECT
  USING (
    item_id IN (
      SELECT ti.id FROM transaction_items ti
      INNER JOIN transactions t ON t.id = ti.transaction_id
      WHERE t.group_id IN (
        SELECT gm.group_id FROM group_members gm
        WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
      )
    )
  );

-- INSERT / UPDATE / DELETE are server-side only.

-- ── settlements ─────────────────────────────────────────────────────────────
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

-- Visible when you're the payer, the recipient, or the settlement belongs
-- to a group you're in.
CREATE POLICY "settlements_select" ON settlements
  FOR SELECT
  USING (
    from_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    OR to_user_id   = (SELECT id FROM users WHERE auth_id = auth.uid())
    OR (
      group_id IN (
        SELECT gm.group_id FROM group_members gm
        WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
      )
    )
  );

-- Members can record settlement payments in their groups.
CREATE POLICY "settlements_insert" ON settlements
  FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
    OR group_id IS NULL  -- legacy rows without group
  );

-- Group members can mark settlements as paid.
CREATE POLICY "settlements_update" ON settlements
  FOR UPDATE
  USING (
    from_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    OR to_user_id   = (SELECT id FROM users WHERE auth_id = auth.uid())
    OR group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );
