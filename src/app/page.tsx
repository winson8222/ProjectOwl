"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BalanceCard from "@/components/BalanceCard";
import UserAvatar from "@/components/UserAvatar";
import { getSessionUser } from "@/lib/session";
import type { BalanceSummary } from "@/lib/actions/balances";

/**
 * Home page — "most down bad" ranking for a selected group,
 * plus the overall (all-groups) balance summary.
 */
export default function HomePage() {
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [ranking, setRanking] = useState<any[] | null>(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setUser(currentUser);

    // Overall balance across all groups
    fetch(`/api/balances?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setBalance(json.data);
        else setError(json.error || "Failed to load balance");
      })
      .catch(() => setError("Failed to connect to the server"));

    // Groups for the ranking selector
    fetch(`/api/groups?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setGroups(json.data);
          if (json.data.length > 0) setSelectedGroupId(json.data[0].id);
        } else {
          setError((prev) => prev || json.error || "Failed to load groups");
        }
      })
      .catch(() => setError((prev) => prev || "Failed to connect to the server"))
      .finally(() => setLoading(false));
  }, []);

  // Load the "most down bad" ranking whenever the selected group changes
  useEffect(() => {
    if (!user || !selectedGroupId) return;
    setRankingLoading(true);
    fetch(`/api/groups/${selectedGroupId}?userId=${user.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setRanking(json.data.downBadRanking);
        else setError((prev) => prev || json.error || "Failed to load ranking");
      })
      .catch(() => setError((prev) => prev || "Failed to connect to the server"))
      .finally(() => setRankingLoading(false));
  }, [user, selectedGroupId]);

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full" />
      </main>
    );
  }

  if (!user) {
    return <UserPickerPage />;
  }

  return (
    <main className="min-h-dvh px-4 pt-6 pb-24 max-w-lg mx-auto">
      {/* Greeting */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Hello, {user.name}</h1>
          <p className="text-xs text-gray-400">Here&apos;s the damage</p>
        </div>
        <UserAvatar name={user.name} size="md" />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          ⚠ {error}
        </div>
      )}

      {/* Most down bad ranking */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900">Most down bad</h2>
        </div>

        {groups.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-8 text-center">
            <p className="text-sm text-gray-400 mb-2">You&apos;re not in any group yet</p>
            <Link href="/groups" className="text-sm font-medium text-[var(--primary)]">
              Create your first group →
            </Link>
          </div>
        ) : (
          <>
            {/* Group selector */}
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="text-xs font-medium text-gray-600 mb-3 px-2 py-1 border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>

            <DownBadRanking ranking={ranking} loading={rankingLoading} currentUserId={user.id} />
          </>
        )}
      </div>

      {/* Overall balance card */}
      {balance && (
        <BalanceCard
          netBalance={balance.netBalance}
          totalOwed={balance.totalOwed}
          totalOwe={balance.totalOwe}
        />
      )}

      {/* Quick actions */}
      <div className="flex gap-3 mt-4">
        <Link
          href="/transactions/new"
          className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-[var(--primary)] rounded-xl hover:bg-[var(--primary-hover)] text-center transition-colors"
        >
          + New transaction
        </Link>
        <Link
          href="/groups"
          className="flex-1 px-4 py-3 text-sm font-semibold text-[var(--primary)] border border-[var(--primary)] rounded-xl hover:bg-blue-50 text-center transition-colors"
        >
          Your groups
        </Link>
      </div>
    </main>
  );
}

/** Podium-style ranking of who owes the most in the selected group. */
function DownBadRanking({
  ranking,
  loading,
  currentUserId,
}: {
  ranking: any[] | null;
  loading: boolean;
  currentUserId: string;
}) {
  if (loading || ranking === null) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 bg-gray-100 rounded-full" />
        ))}
      </div>
    );
  }

  if (ranking.length === 0) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-6 text-center">
        <p className="text-sm text-gray-500 font-medium">No one is down bad 🎉</p>
        <p className="text-xs text-gray-400 mt-1">Everyone in this group is settled</p>
      </div>
    );
  }

  const top = ranking.slice(0, 3);
  const maxOwed = Math.abs(top[0].net);
  const barColors = ["bg-lime-400", "bg-sky-400", "bg-rose-400"];
  const badgeColors = ["bg-lime-500", "bg-sky-500", "bg-rose-500"];

  return (
    <div className="space-y-2">
      {top.map((entry, i) => {
        const owed = Math.abs(entry.net);
        const widthPct = Math.max(30, Math.round((owed / maxOwed) * 100));
        const isYou = entry.user.id === currentUserId;
        return (
          <div key={entry.user.id} className="flex items-center gap-2">
            <span
              className={`w-8 h-8 ${badgeColors[i]} rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 border-2 border-white shadow`}
            >
              {i + 1}
            </span>
            <div
              className={`${barColors[i]} h-9 rounded-r-full rounded-l-md flex items-center justify-between px-3 min-w-0`}
              style={{ width: `${widthPct}%` }}
            >
              <span className="text-sm font-semibold text-white truncate">
                {isYou ? "You" : entry.user.name}
              </span>
            </div>
            <span className="text-xs font-semibold text-gray-500 shrink-0">
              owes ${owed.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Session picker — shown when no user is selected */
function UserPickerPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setUsers(json.data);
      })
      .catch(console.error);
  }, []);

  const selectUser = (user: any) => {
    sessionStorage.setItem("projectowl_user", JSON.stringify(user));
    window.location.reload();
  };

  const createUser = async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        selectUser(json.data);
      }
    } catch (err) {
      console.error("Failed to create user:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4">
      <div className="text-5xl mb-4">🦉</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">ProjectOwl</h1>
      <p className="text-sm text-gray-500 mb-8">Who are you?</p>

      <div className="space-y-2 w-full max-w-xs">
        {users.map((user: any) => (
          <button
            key={user.id}
            onClick={() => selectUser(user)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:bg-gray-50 transition-colors"
          >
            <UserAvatar name={user.name} size="sm" />
            <span className="text-sm font-medium text-gray-900">{user.name}</span>
          </button>
        ))}
      </div>

      {/* Toggle create form */}
      <button
        onClick={() => setShowCreate(!showCreate)}
        className="mt-4 text-sm text-[var(--primary)] font-medium hover:underline"
      >
        {showCreate ? "Cancel" : "+ Create new user"}
      </button>

      {showCreate && (
        <div className="mt-3 w-full max-w-xs space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
          <button
            onClick={createUser}
            disabled={creating || !newName.trim() || !newEmail.trim()}
            className="w-full px-4 py-2 text-sm font-semibold text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating..." : "Create & sign in"}
          </button>
        </div>
      )}
    </main>
  );
}
