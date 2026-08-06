"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import TransactionCard from "@/components/TransactionCard";
import SwipeableRow from "@/components/SwipeableRow";
import PaidStamp from "@/components/PaidStamp";
import UserAvatar from "@/components/UserAvatar";
import UserPicker from "@/components/UserPicker";
import ErrorDialog from "@/components/ErrorDialog";
import { getSessionUser } from "@/lib/session";
import { authMode } from "@/lib/auth/mode";
import { tapHeavy, tapError } from "@/lib/haptics";

/**
 * Group detail page — members / balances / settle-up actions, pairwise
 * "who owes you" lines, and the group's transaction ledger.
 */
export default function GroupDetailPage() {
  const params = useParams();
  const groupId = params.id as string;

  const [user, setUser] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showMembers, setShowMembers] = useState(false);
  const [showBalances, setShowBalances] = useState(false);

  const loadData = useCallback((currentUser: any) => {
    fetch(`/api/groups/${groupId}?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setGroup(json.data);
        else setError(json.error || "Failed to load group");
      })
      .catch(() => setError("Failed to connect to the server"));

    fetch(`/api/transactions?userId=${currentUser.id}&groupId=${groupId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setTransactions(json.data);
        else setError((prev) => prev || json.error || "Failed to load transactions");
      })
      .catch(() => setError((prev) => prev || "Failed to connect to the server"))
      .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setUser(currentUser);
    loadData(currentUser);
  }, [loadData]);

  /** Swipe-to-reveal delete. The row goes immediately, then loadData resyncs —
   *  deleting a transaction moves this group's nets and transfer plan, so the
   *  balances above the ledger can't just be spliced locally. */
  const handleDelete = useCallback(
    async (id: string) => {
      const previous = transactions;
      setTransactions((rows) => rows.filter((t) => t.id !== id));
      tapHeavy();
      try {
        const res = await fetch(`/api/transactions?id=${id}`, { method: "DELETE" });
        const json = await res.json();
        if (!json.success) {
          setTransactions(previous);
          tapError();
          setError(json.error || "Failed to delete transaction.");
          return;
        }
        if (user) loadData(user);
      } catch {
        setTransactions(previous);
        tapError();
        setError("Failed to connect to the server.");
      }
    },
    [transactions, user, loadData]
  );

  if (!user) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <p className="text-sm text-ink-muted">Please select a user from the home page first.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full" />
      </main>
    );
  }

  if (!group) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center p-4 gap-3">
        <p className="text-sm text-ink-muted">{error || "Group not found"}</p>
        <Link href="/groups" className="text-sm font-medium text-[var(--primary)]">
          ← Back to groups
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-4 pt-6 max-w-lg mx-auto animate-slide-in-right content-with-floating-nav">
      <Link href="/groups" className="text-sm text-ink-muted hover:text-ink mb-4 block">
        ← Groups
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-full shrink-0"
          style={{ backgroundColor: group.color || "#9ca3af" }}
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink truncate">{group.name}</h1>
          <p className="text-xs text-ink-muted">
            {group.members.length} member{group.members.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Action chips */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowMembers(true)}
          className="px-3 py-1.5 text-xs font-semibold text-[var(--primary)] rounded-lg backdrop-blur-sm pressable"
          style={{
            border: '1px solid var(--color-blueberry-700)',
            background: 'var(--color-blueberry-100)',
            boxShadow: '0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)'
          }}
        >
          members
        </button>
        <button
          onClick={() => setShowBalances(true)}
          className="px-3 py-1.5 text-xs font-semibold text-[var(--primary)] rounded-lg backdrop-blur-sm pressable"
          style={{
            border: '1px solid var(--color-blueberry-700)',
            background: 'var(--color-blueberry-100)',
            boxShadow: '0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)'
          }}
        >
          balances
        </button>
        <Link
          href={`/groups/${groupId}/settle-up`}
          className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg backdrop-blur-sm pressable"
          style={{
            background: 'var(--color-blueberry-600)',
            border: '1px solid var(--color-blueberry-700)',
            boxShadow: '0 2px 6px color-mix(in srgb, var(--color-blueberry-900) 22%, transparent), 0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          settle up
        </Link>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-negative-tint border border-negative-soft rounded-xl text-sm text-negative">
          ⚠ {error}
        </div>
      )}

      {/* Pairwise summary vs. you */}
      {group.yourPairwise?.length > 0 && (
        <div className="mb-4 space-y-0.5">
          {group.yourPairwise.map((p: any) => (
            <p key={p.user.id} className="text-sm">
              {p.amount > 0 ? (
                <>
                  <span className="font-medium text-ink">{p.user.name}</span>
                  <span className="text-ink-muted"> owes you </span>
                  <span className="font-semibold text-[var(--success)]">
                    ${p.amount.toFixed(2)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-ink-muted">You owe </span>
                  <span className="font-medium text-ink">{p.user.name}</span>{" "}
                  <span className="font-semibold text-[var(--danger)]">
                    ${Math.abs(p.amount).toFixed(2)}
                  </span>
                </>
              )}
            </p>
          ))}
        </div>
      )}

      {/* Group is square — the resting watermark. Only once the group has
          actually seen activity, so an empty new group isn't stamped PAID. */}
      {transactions.length > 0 && !group.yourPairwise?.length && (
        <div
          className="relative rounded-[14px] mb-4 overflow-hidden"
          style={{
            height: 96,
            background: "var(--color-surface)",
            border: "1px solid var(--color-hairline)",
          }}
        >
          <PaidStamp />
        </div>
      )}

      {/* Transactions */}
      <div className="space-y-2">
        {transactions.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-8">
            No transactions in this group yet
          </p>
        ) : (
          transactions.map((tx: any) => (
            <SwipeableRow key={tx.id} onDelete={() => handleDelete(tx.id)}>
              <TransactionCard
                id={tx.id}
                title={tx.title}
                totalAmount={tx.totalAmount}
                userShare={tx.userShare}
                paidByUserName={tx.paidByUser?.name ?? "Unknown"}
                paidByUserId={tx.paidByUserId}
                currentUserId={user.id}
                transactionDate={tx.transactionDate}
                type={tx.type}
                recipientName={tx.participants?.[0]?.user?.name}
                recipientUserId={tx.participants?.[0]?.user?.id}
              />
            </SwipeableRow>
          ))
        )}
      </div>

      {/* Floating add button — a single tap to the expense composer.
          It used to expand into a two-option menu whose second option was
          "Record a payment". Settle-up is now the only door into the payment
          flow, so the menu had nothing left to choose between. */}
      <Link
        href={`/transactions/new?groupId=${groupId}`}
        className="pressable fixed right-5 z-30 w-14 h-14 text-white rounded-full flex items-center justify-center text-3xl font-light shadow-lg"
        style={{
          bottom: "calc(var(--nav-clearance) + 0.5rem)",
          background: "var(--color-blueberry-600)",
          boxShadow:
            "0 6px 20px color-mix(in srgb, var(--color-blueberry-900) 30%, transparent)",
        }}
        aria-label="Add an expense"
      >
        +
      </Link>

      {/* Members sheet */}
      {showMembers && (
        <MembersSheet
          group={group}
          currentUser={user}
          onClose={() => setShowMembers(false)}
          onMembersChanged={() => loadData(user)}
        />
      )}

      {/* Balances sheet */}
      {showBalances && (
        <BalancesSheet
          group={group}
          currentUserId={user.id}
          onClose={() => setShowBalances(false)}
        />
      )}
    </main>
  );
}

/** Full-screen sheet header used by both modals. */
function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[var(--primary)] text-white">
      <button onClick={onClose} className="text-2xl leading-none" aria-label="Close">
        ✕
      </button>
      <h2 className="flex-1 text-center text-base font-semibold pr-7">{title}</h2>
    </div>
  );
}

/** Group Balances — each member's net position ("gets back" / "owes"). */
function BalancesSheet({
  group,
  currentUserId,
  onClose,
}: {
  group: any;
  currentUserId: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-surface-raised z-50 flex flex-col md:max-w-3xl md:mx-auto">
      <SheetHeader title="Group Balances" onClose={onClose} />
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
        {group.memberBalances.map((b: any) => {
          const isYou = b.user.id === currentUserId;
          const settled = Math.abs(b.net) < 0.005;
          return (
            <div key={b.user.id} className="px-4 py-4 flex items-center gap-3">
              <UserAvatar name={b.user.name} size="sm" />
              <p className="flex-1 text-sm font-medium text-ink">
                {b.user.name}
                {isYou && <span className="text-ink-muted"> (You)</span>}
              </p>
              {settled ? (
                <p className="text-xs text-ink-muted">settled</p>
              ) : (
                <p
                  className={`text-sm font-semibold ${
                    b.net > 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
                  }`}
                >
                  {b.net > 0 ? "gets back" : "owes"} ${Math.abs(b.net).toFixed(2)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Member list + add-by-email + shareable invite link. */
function MembersSheet({
  group,
  currentUser,
  onClose,
  onMembersChanged,
}: {
  group: any;
  currentUser: any;
  onClose: () => void;
  onMembersChanged: () => void;
}) {
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addedName, setAddedName] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [dialogError, setDialogError] = useState<{ title: string; message: string } | null>(null);

  // Mock mode only: quick-add picker over all seeded users, for easy local
  // testing. GET /api/users is open in mock mode but signed-in-gated (and
  // enumerable-by-design) in supabase mode, so this never renders there.
  const isMock = authMode() === "mock";
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [toAdd, setToAdd] = useState<string[]>([]);

  useEffect(() => {
    if (!isMock) return;
    fetch("/api/users")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setAllUsers(json.data);
      })
      .catch(console.error);
  }, [isMock]);

  const memberIds = new Set(group.members.map((m: any) => m.id));
  const addable = allUsers.filter((u) => !memberIds.has(u.id));

  const quickAdd = async () => {
    if (toAdd.length === 0) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: toAdd }),
      });
      const json = await res.json();
      if (json.success) {
        setToAdd([]);
        onMembersChanged();
      } else {
        setDialogError({ title: "Add failed", message: json.error || "Failed to add members" });
      }
    } catch {
      setDialogError({ title: "Add failed", message: "Failed to connect to the server" });
    } finally {
      setAdding(false);
    }
  };

  const addByEmail = async () => {
    if (!email.trim()) return;
    setAdding(true);
    setAddedName(null);
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setEmail("");
        const before = new Set(group.members.map((m: any) => m.id));
        const added = json.data.find((m: any) => !before.has(m.id));
        setAddedName(added?.name ?? "Member");
        onMembersChanged();
      } else {
        setDialogError({ title: "Add failed", message: json.error || "Failed to add member" });
      }
    } catch {
      setDialogError({ title: "Add failed", message: "Failed to connect to the server" });
    } finally {
      setAdding(false);
    }
  };

  const copyInviteLink = async () => {
    setInviteBusy(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/invites`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        setDialogError({ title: "Invite failed", message: json.error || "Failed to create invite link" });
        return;
      }
      const url = `${window.location.origin}${json.data.path}`;
      try {
        await navigator.clipboard.writeText(url);
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2000);
      } catch {
        // Clipboard blocked (e.g. non-HTTPS) — show the link so it can be copied manually.
        setDialogError({ title: "Invite link", message: url });
      }
    } catch {
      setDialogError({ title: "Invite failed", message: "Failed to connect to the server" });
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-surface-raised z-50 flex flex-col md:max-w-3xl md:mx-auto">
      <SheetHeader title="Members" onClose={onClose} />
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-[var(--border)]">
          {group.members.map((m: any) => (
            <div key={m.id} className="px-4 py-3 flex items-center gap-3">
              <UserAvatar name={m.name} size="sm" />
              <p className="flex-1 text-sm font-medium text-ink">
                {m.name}
                {m.id === currentUser.id && <span className="text-ink-muted"> (You)</span>}
              </p>
              {m.id === group.createdByUserId && (
                <span className="text-[10px] text-ink-muted uppercase tracking-wider">creator</span>
              )}
            </div>
          ))}
        </div>

        {/* Add by email */}
        <div className="px-4 py-4 border-t border-[var(--border)] bg-canvas">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
            Add by email
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setAddedName(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && addByEmail()}
              placeholder="friend@example.com"
              className="flex-1 px-3 py-2.5 text-sm border border-[var(--border)] rounded-lg bg-surface-raised focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <button
              onClick={addByEmail}
              disabled={adding || !email.trim()}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
            >
              {adding ? "Adding..." : "Add"}
            </button>
          </div>
          {addedName && (
            <p className="mt-2 text-sm text-positive">✓ {addedName} added to the group</p>
          )}

          {/* Invite link for people without an account yet */}
          <p className="mt-4 text-xs text-ink-muted">
            Don&apos;t know their email, or they don&apos;t have an account yet?
          </p>
          <button
            onClick={copyInviteLink}
            disabled={inviteBusy}
            className="w-full mt-2 px-4 py-2.5 text-sm font-semibold text-[var(--primary)] border border-[var(--primary)] rounded-lg hover:bg-blueberry-100 disabled:opacity-50 transition-colors"
          >
            {inviteCopied ? "✓ Link copied" : inviteBusy ? "Creating link..." : "Copy invite link"}
          </button>
        </div>

        {/* Mock mode: pick any seeded user directly (local testing shortcut) */}
        {isMock && (
          <div className="px-4 py-4 border-t border-[var(--border)] bg-canvas">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
              Quick add (local dev)
            </p>
            {addable.length === 0 ? (
              <p className="text-sm text-ink-muted">Everyone is already in this group</p>
            ) : (
              <>
                <UserPicker
                  selectedUserIds={toAdd}
                  onChange={setToAdd}
                  users={addable}
                  label=""
                />
                <button
                  onClick={quickAdd}
                  disabled={adding || toAdd.length === 0}
                  className="w-full mt-3 px-4 py-2.5 text-sm font-semibold text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
                >
                  {adding ? "Adding..." : `Add ${toAdd.length || ""} member${toAdd.length === 1 ? "" : "s"}`}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <ErrorDialog
        open={!!dialogError}
        title={dialogError?.title || "Error"}
        message={dialogError?.message || ""}
        onDismiss={() => setDialogError(null)}
      />
    </div>
  );
}
