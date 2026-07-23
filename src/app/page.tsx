"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import GroupPickerWheel from "@/components/GroupPickerWheel";
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
  const [memberBalances, setMemberBalances] = useState<any[] | null>(null);
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
        if (json.success) setMemberBalances(json.data.memberBalances);
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
    <main className="min-h-dvh px-4 pt-2 pb-24 max-w-lg mx-auto">
      {/* Greeting */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-500">Hello, {user.name}</h1>
        </div>
        <UserAvatar name={user.name} size="md" />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          ⚠ {error}
        </div>
      )}

      {/* Net balance sentence */}
      {balance && memberBalances && (
        <div className="mb-6">
          {/* Calculate user's rank in the group */}
          {(() => {
            const sortedByNet = [...memberBalances].sort((a, b) => b.net - a.net);
            const userRank = sortedByNet.findIndex(entry => entry.user.id === user.id) + 1;

            return (
              <>
                {/* Hero number card with animated background */}
                <div
                  className={`rounded-2xl p-6 text-center mb-4 relative overflow-hidden border ${
                    balance.netBalance >= 0 ? 'border-gray-200' : 'border-red-100'
                  }`}
                  style={{
                    background: balance.netBalance >= 0
                      ? 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(248,250,252,0.3) 100%)'
                      : 'linear-gradient(135deg, rgba(254,226,226,0.4) 0%, rgba(253,242,242,0.3) 100%)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03), 0 4px 8px rgba(0,0,0,0.02)'
                  }}
                >
                  {/* Animated background based on rank and status */}
                  {balance.netBalance > 0 ? (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className={`raining-cash rank-${userRank}`}>
                        {Array.from({ length: Math.min(Math.max(Math.floor(balance.netBalance / 2), 6), 30) }).map((_, i) => (
                          <span key={i}>💵</span>
                        ))}
                      </div>
                    </div>
                  ) : balance.netBalance < 0 ? (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="falling-gandhi">
                        {Array.from({ length: Math.min(Math.max(Math.floor(Math.abs(balance.netBalance) / 2), 6), 30) }).map((_, i) => (
                          <img key={i} src="/gandhi.png" alt="Gandhi" className="gandhi-icon" />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <p className="text-sm text-gray-400 uppercase tracking-wider mb-2 relative z-10">
                    {balance.netBalance >= 0 ? "UP GOOD" : "DOWN BAD"}
                  </p>
                  <p className={`text-4xl font-bold ${balance.netBalance >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"} relative z-10`}>
                    {balance.netBalance >= 0 ? "+" : "-"}${Math.abs(balance.netBalance).toFixed(2)}
                  </p>

                  {/* Breakdown sentence */}
                  <div className="text-center text-sm relative z-10">
                    You are owed <span className="text-[var(--success)] font-bold">
                      ${balance.totalOwed.toFixed(2)}
                    </span>, and you owe <span className="text-[var(--danger)] font-bold">
                      ${balance.totalOwe.toFixed(2)}
                    </span>.
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Most down bad ranking */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900">Down Bad Leaderboard</h2>
        </div>

        {groups.length === 0 ? (
          <div
            className="border border-gray-200 rounded-xl px-5 py-8 text-center backdrop-blur-sm"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.02)'
            }}
          >
            <p className="text-sm text-gray-400 mb-2">You&apos;re not in any group yet</p>
            <Link href="/groups" className="text-sm font-medium text-[var(--primary)]">
              Create your first group →
            </Link>
          </div>
        ) : (
          <>
            {/* Group scroll wheel picker */}
            <GroupPickerWheel
              groups={groups}
              selectedGroupId={selectedGroupId}
              onGroupChange={(groupId) => setSelectedGroupId(groupId)}
            />

            <DownBadRanking ranking={memberBalances} loading={rankingLoading} currentUserId={user.id} />
          </>
        )}
      </div>
    </main>
  );
}

/** Get color based on amount type (no intensity gradient) */
function getColorIntensity(isOwed: boolean): { barColor: React.CSSProperties; textColor: React.CSSProperties } {
  // Same colors as BalanceCard: --success and --danger
  if (isOwed) {
    // Green: #3aa542 (same as var(--success))
    return {
      barColor: { backgroundColor: '#3aa542' },
      textColor: { color: '#2a7a32' }, // darker green for text
    };
  } else {
    // Red: #c5423a (same as var(--danger))
    return {
      barColor: { backgroundColor: '#c5423a' },
      textColor: { color: '#a5322a' }, // darker red for text
    };
  }
}

/** Bidirectional ranking chart showing who owes (left) vs who's owed (right) */
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
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  // Sort by net value (most negative first, most positive last)
  const sortedRanking = [...ranking].sort((a, b) => a.net - b.net);

  // Show top 6 (3 most negative, 3 most positive)
  const top = sortedRanking.slice(0, 6);

  // Calculate max absolute value for scaling
  const maxAbs = Math.max(...sortedRanking.map((entry) => Math.abs(entry.net)));

  if (top.length === 0) {
    return (
      <div
        className="border border-gray-200 rounded-xl px-5 py-6 text-center backdrop-blur-sm"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.02)'
        }}
      >
        <p className="text-sm text-gray-500 font-medium">No one is down bad 🎉</p>
        <p className="text-xs text-gray-400 mt-1">Everyone in this group is settled</p>
      </div>
    );
  }

  return (
    <div
      className="border border-gray-200 rounded-xl p-5 backdrop-blur-sm"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.02)'
      }}
    >
      <div className="space-y-3">
        {top.map((entry) => {
          const amount = entry.net;
          const absAmount = Math.abs(amount);
          const isOwed = amount > 0;
          const isYou = entry.user.id === currentUserId;

          // Get colors based on type
          const { barColor, textColor } = getColorIntensity(isOwed);

          // Calculate bar width and position
          // Bar grows from center: negative goes left, positive goes right
          // Cap at 40% to ensure bar never reaches the numbers on either side
          const maxBarWidth = 40;
          const barWidth = maxAbs > 0 ? (absAmount / maxAbs) * maxBarWidth : 0;

          return (
            <div key={entry.user.id} className="relative h-8 flex items-center">
              {/* Name on left */}
              <span className={`text-sm font-semibold w-20 truncate z-10 ${isYou ? "text-[var(--primary)]" : "text-gray-700"}`}>
                {isYou ? "You" : entry.user.name}
              </span>

              {/* Background bar container - centered */}
              <div className="absolute left-20 right-20 h-6 flex items-center">
                {/* Center reference line (subtle) */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 -translate-x-1/2" />

                {/* Bar track with inset shadow */}
                <div className="absolute left-0 right-0 top-1 bottom-1 bg-gray-100/50 rounded-sm"
                     style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.08)' }} />

                {/* Colored bar - grows from center with soft shadow */}
                {Math.abs(amount) >= 0.01 && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-4 rounded-sm"
                    style={{
                      ...barColor,
                      left: amount > 0 ? '50%' : `${50 - barWidth}%`,
                      right: amount < 0 ? '50%' : `${50 - barWidth}%`,
                      opacity: 0.7,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    }}
                  />
                )}
              </div>

              {/* Amount on right */}
              <div className="absolute right-4 text-sm font-bold z-10" style={textColor}>
                ${Math.abs(amount).toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
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
