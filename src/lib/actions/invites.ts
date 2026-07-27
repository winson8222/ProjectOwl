import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { v4 as uuid } from "uuid";
import { localTimestamp } from "@/lib/time";
import { logActivity } from "./activities";
import { getGroupMemberIds } from "./groups";
import type { User } from "./users";

export type GroupInvite = typeof schema.groupInvites.$inferSelect;

/** How long a fresh invite link stays valid. */
const INVITE_TTL_DAYS = 7;

/** expiresAt in the same "YYYY-MM-DD HH:MM:SS" TEXT format as createdAt. */
function expiryTimestamp(): string {
  const d = new Date(Date.now() + INVITE_TTL_DAYS * 86400000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}

function isExpired(invite: GroupInvite): boolean {
  return invite.expiresAt !== null && invite.expiresAt < localTimestamp();
}

/**
 * Get a shareable invite token for a group. Reuses the group's newest
 * still-valid token so repeated "copy link" clicks don't mint junk rows;
 * otherwise creates a fresh one valid for INVITE_TTL_DAYS.
 */
export async function createGroupInvite(groupId: string, createdByUserId: string): Promise<GroupInvite> {
  const db = getDb();

  const existing = await db
    .select()
    .from(schema.groupInvites)
    .where(eq(schema.groupInvites.groupId, groupId));
  const valid = existing.filter((i) => !isExpired(i)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (valid[0]) return valid[0];

  const rows = await db
    .insert(schema.groupInvites)
    .values({
      token: randomUUID(),
      groupId,
      createdByUserId,
      expiresAt: expiryTimestamp(),
      createdAt: localTimestamp(),
    })
    .returning();
  return rows[0];
}

export interface InvitePreview {
  token: string;
  group: { id: string; name: string; color: string | null };
  invitedBy: string; // name of the link creator
  memberCount: number;
  /** True when the signed-in viewer is already in the group. */
  alreadyMember: boolean;
}

/** Resolve an invite token for the join page. Null = unknown or expired. */
export async function getInvitePreview(token: string, viewerId: string): Promise<InvitePreview | null> {
  const db = getDb();
  const invite = (await db.select().from(schema.groupInvites).where(eq(schema.groupInvites.token, token)))[0];
  if (!invite || isExpired(invite)) return null;

  const group = (await db.select().from(schema.groups).where(eq(schema.groups.id, invite.groupId)))[0];
  if (!group) return null;
  const creator = (await db.select().from(schema.users).where(eq(schema.users.id, invite.createdByUserId)))[0];
  const memberIds = await getGroupMemberIds(invite.groupId);

  return {
    token: invite.token,
    group: { id: group.id, name: group.name, color: group.color },
    invitedBy: creator?.name ?? "Someone",
    memberCount: memberIds.length,
    alreadyMember: memberIds.includes(viewerId),
  };
}

/**
 * Join a group via an invite token. Idempotent: already a member → returns
 * the groupId without inserting. Null = unknown or expired token.
 */
export async function acceptGroupInvite(token: string, user: User): Promise<string | null> {
  const db = getDb();
  const invite = (await db.select().from(schema.groupInvites).where(eq(schema.groupInvites.token, token)))[0];
  if (!invite || isExpired(invite)) return null;

  const memberIds = await getGroupMemberIds(invite.groupId);
  if (memberIds.includes(user.id)) return invite.groupId;

  await db.insert(schema.groupMembers).values({
    id: `gm-${uuid().slice(0, 8)}`,
    groupId: invite.groupId,
    userId: user.id,
    createdAt: localTimestamp(),
  });
  await logActivity({ type: "member_joined", userId: user.id, groupId: invite.groupId });
  return invite.groupId;
}
