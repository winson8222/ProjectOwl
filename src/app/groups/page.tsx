"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import BalanceCard from "@/components/BalanceCard";
import UserPicker from "@/components/UserPicker";
import ErrorDialog from "@/components/ErrorDialog";
import { getSessionUser } from "@/lib/session";

/**
 * Groups tab — overall balance, list of your groups (settled ones hidden
 * behind a toggle), and a create-group form with a member picker.
 */
export default function GroupsPage() {
  const [user, setUser] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettled, setShowSettled] = useState(false);

  // Create-group form state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMembers, setNewMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [dialogError, setDialogError] = useState<{ title: string; message: string } | null>(null);

  const loadData = useCallback((currentUser: any) => {
    fetch(`/api/groups?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setGroups(json.data);
        else setError(json.error || "Failed to load groups");
      })
      .catch(() => setError("Failed to connect to the server"))
      .finally(() => setLoading(false));

    fetch(`/api/balances?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setBalance(json.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setUser(currentUser);
    loadData(currentUser);
  }, [loadData]);

  const createGroup = async () => {
    if (!newName.trim() || !user) return;
    setCreating(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          memberIds: newMembers,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowCreate(false);
        setNewName("");
        setNewMembers([]);
        setLoading(true);
        loadData(user);
      } else {
        setDialogError({ title: "Create failed", message: json.error || "Failed to create group" });
      }
    } catch {
      setDialogError({ title: "Create failed", message: "Failed to connect to the server" });
    } finally {
      setCreating(false);
    }
  };

  if (!user) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <p className="text-sm text-gray-500">Please select a user from the home page first.</p>
      </main>
    );
  }

  const activeGroups = groups.filter((g) => !g.isSettled);
  const settledGroups = groups.filter((g) => g.isSettled);

  return (
    <main className="min-h-dvh px-4 pt-6 pb-24 max-w-lg mx-auto">
      {/* Overall balance */}
      {balance && (
        <div className="mb-6">
          <BalanceCard
            netBalance={balance.netBalance}
            totalOwed={balance.totalOwed}
            totalOwe={balance.totalOwe}
          />
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Your Groups</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-sm font-semibold text-[var(--primary)] px-3 py-1.5 border border-[var(--primary)] rounded-lg hover:bg-blue-50"
        >
          {showCreate ? "Cancel" : "+ New group"}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          ⚠ {error}
        </div>
      )}

      {/* Create group form */}
      {showCreate && (
        <div className="mb-4 bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Group name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Roommates, Japan Trip"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Participants (you&apos;re always included)
            </label>
            <UserPicker
              selectedUserIds={newMembers}
              onChange={setNewMembers}
              excludeUserId={user.id}
              label=""
            />
          </div>
          <button
            onClick={createGroup}
            disabled={creating || !newName.trim()}
            className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating..." : "Create group"}
          </button>
        </div>
      )}

      {/* Group list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full" />
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          No groups yet — create one to start splitting!
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {activeGroups.map((g) => <GroupRow key={g.id} group={g} />)}
            {activeGroups.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">All your groups are settled 🎉</p>
            )}
          </div>

          {/* Settled groups toggle */}
          {settledGroups.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowSettled(!showSettled)}
                className="w-full px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                {showSettled ? "Hide" : "Show"} settled groups ({settledGroups.length})
              </button>
              {showSettled && (
                <div className="space-y-2 mt-2">
                  {settledGroups.map((g) => <GroupRow key={g.id} group={g} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ErrorDialog
        open={!!dialogError}
        title={dialogError?.title || "Error"}
        message={dialogError?.message || ""}
        onDismiss={() => setDialogError(null)}
      />
    </main>
  );
}

/** One tappable group row: colored circle, name, your net position. */
function GroupRow({ group }: { group: any }) {
  const net = group.yourNet ?? 0;
  return (
    <Link
      href={`/groups/${group.id}`}
      className="flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:bg-gray-50 transition-colors"
    >
      <div
        className="w-10 h-10 rounded-full shrink-0"
        style={{ backgroundColor: group.color || "#9ca3af" }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{group.name}</p>
        <p className="text-xs text-gray-400">
          {group.members.length} member{group.members.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="text-right">
        {Math.abs(net) < 0.005 ? (
          <p className="text-xs text-gray-400">Settled</p>
        ) : (
          <>
            <p className={`text-sm font-semibold ${net > 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
              {net > 0 ? "+" : "-"}${Math.abs(net).toFixed(2)}
            </p>
            <p className="text-[10px] text-gray-400">
              {net > 0 ? "you get back" : "you owe"}
            </p>
          </>
        )}
      </div>
    </Link>
  );
}
