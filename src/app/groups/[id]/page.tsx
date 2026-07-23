"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import TransactionCard from "@/components/TransactionCard";
import UserAvatar from "@/components/UserAvatar";
import UserPicker from "@/components/UserPicker";
import ErrorDialog from "@/components/ErrorDialog";
import { getSessionUser } from "@/lib/session";

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
  const [fabOpen, setFabOpen] = useState(false);

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

  if (!user) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <p className="text-sm text-gray-500">Please select a user from the home page first.</p>
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
        <p className="text-sm text-gray-500">{error || "Group not found"}</p>
        <Link href="/groups" className="text-sm font-medium text-[var(--primary)]">
          ← Back to groups
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-4 pt-6 pb-24 max-w-lg mx-auto">
      <Link href="/groups" className="text-sm text-gray-500 hover:text-gray-700 mb-4 block">
        ← Groups
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-full shrink-0"
          style={{ backgroundColor: group.color || "#9ca3af" }}
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{group.name}</h1>
          <p className="text-xs text-gray-400">
            {group.members.length} member{group.members.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Action chips */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowMembers(true)}
          className="px-3 py-1.5 text-xs font-semibold text-[var(--primary)] border border-[var(--primary)] rounded-lg hover:bg-blue-50"
        >
          members
        </button>
        <button
          onClick={() => setShowBalances(true)}
          className="px-3 py-1.5 text-xs font-semibold text-[var(--primary)] border border-[var(--primary)] rounded-lg hover:bg-blue-50"
        >
          balances
        </button>
        <Link
          href={`/groups/${groupId}/settle-up`}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)]"
        >
          settle up
        </Link>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
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
                  <span className="font-medium text-gray-900">{p.user.name}</span>
                  <span className="text-gray-500"> owes you </span>
                  <span className="font-semibold text-[var(--success)]">
                    ${p.amount.toFixed(2)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-gray-500">You owe </span>
                  <span className="font-medium text-gray-900">{p.user.name}</span>{" "}
                  <span className="font-semibold text-[var(--danger)]">
                    ${Math.abs(p.amount).toFixed(2)}
                  </span>
                </>
              )}
            </p>
          ))}
        </div>
      )}

      {/* Transactions */}
      <div className="space-y-2">
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No transactions in this group yet
          </p>
        ) : (
          transactions.map((tx: any) => (
            <TransactionCard
              key={tx.id}
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
          ))
        )}
      </div>

      {/* Floating add button — opens a choice: new expense or record a payment */}
      {fabOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={() => setFabOpen(false)}
          aria-hidden
        />
      )}
      <div className="fixed bottom-24 right-5 z-30 flex flex-col items-end gap-3">
        {fabOpen && (
          <>
            <Link
              href={`/payments/new?groupId=${groupId}`}
              className="flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-full shadow-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
            >
              💸 Record a payment
            </Link>
            <Link
              href={`/transactions/new?groupId=${groupId}`}
              className="flex items-center gap-2 px-4 py-3 bg-[var(--primary)] text-white rounded-full shadow-lg text-sm font-semibold hover:bg-[var(--primary-hover)] transition-colors"
            >
              🧾 New transaction
            </Link>
          </>
        )}
        <button
          onClick={() => setFabOpen((o) => !o)}
          className={`w-14 h-14 bg-[var(--primary)] text-white rounded-full flex items-center justify-center text-3xl font-light shadow-lg hover:bg-[var(--primary-hover)] transition-transform ${
            fabOpen ? "rotate-45" : ""
          }`}
          aria-label={fabOpen ? "Close add menu" : "Add transaction or payment"}
          aria-expanded={fabOpen}
        >
          +
        </button>
      </div>

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
    <div className="fixed inset-0 bg-white z-50 flex flex-col md:max-w-3xl md:mx-auto">
      <SheetHeader title="Group Balances" onClose={onClose} />
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
        {group.memberBalances.map((b: any) => {
          const isYou = b.user.id === currentUserId;
          const settled = Math.abs(b.net) < 0.005;
          return (
            <div key={b.user.id} className="px-4 py-4 flex items-center gap-3">
              <UserAvatar name={b.user.name} size="sm" />
              <p className="flex-1 text-sm font-medium text-gray-900">
                {b.user.name}
                {isYou && <span className="text-gray-400"> (You)</span>}
              </p>
              {settled ? (
                <p className="text-xs text-gray-400">settled</p>
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

/** Member list + add-participants form. */
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
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [toAdd, setToAdd] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [dialogError, setDialogError] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setAllUsers(json.data);
      })
      .catch(console.error);
  }, []);

  const memberIds = new Set(group.members.map((m: any) => m.id));
  const addable = allUsers.filter((u) => !memberIds.has(u.id));

  const addMembers = async () => {
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
        onClose();
      } else {
        setDialogError({ title: "Add failed", message: json.error || "Failed to add members" });
      }
    } catch {
      setDialogError({ title: "Add failed", message: "Failed to connect to the server" });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col md:max-w-3xl md:mx-auto">
      <SheetHeader title="Members" onClose={onClose} />
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-[var(--border)]">
          {group.members.map((m: any) => (
            <div key={m.id} className="px-4 py-3 flex items-center gap-3">
              <UserAvatar name={m.name} size="sm" />
              <p className="flex-1 text-sm font-medium text-gray-900">
                {m.name}
                {m.id === currentUser.id && <span className="text-gray-400"> (You)</span>}
              </p>
              {m.id === group.createdByUserId && (
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">creator</span>
              )}
            </div>
          ))}
        </div>

        {/* Add participants */}
        <div className="px-4 py-4 border-t border-[var(--border)] bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Add participants
          </p>
          {addable.length === 0 ? (
            <p className="text-sm text-gray-400">Everyone is already in this group</p>
          ) : (
            <>
              <UserPicker
                selectedUserIds={toAdd}
                onChange={setToAdd}
                users={addable}
                label=""
              />
              <button
                onClick={addMembers}
                disabled={adding || toAdd.length === 0}
                className="w-full mt-3 px-4 py-2.5 text-sm font-semibold text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
              >
                {adding ? "Adding..." : `Add ${toAdd.length || ""} member${toAdd.length === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        </div>
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
