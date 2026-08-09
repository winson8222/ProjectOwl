"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import GroupPickerWheel from "@/components/GroupPickerWheel";
import PullToRefresh from "@/components/PullToRefresh";
import PaidStamp from "@/components/PaidStamp";
import { getSessionUser } from "@/lib/session";
import { isSettled, isNetZeroButOpen } from "@/lib/settled";
import type { BalanceSummary } from "@/lib/actions/balances";

/**
 * Home page — "most down bad" ranking for a selected group,
 * plus the overall (all-groups) balance summary.
 */
export default function HomePage() {
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const loadData = useCallback((currentUser: { id: string }) => {
    setError(null);

    // Overall balance across all groups
    const balancePromise = fetch(`/api/balances?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setBalance(json.data);
        else setError(json.error || "Failed to load balance");
      })
      .catch(() => setError("Failed to connect to the server"));

    // Groups for the ranking selector. Each group already carries its
    // memberBalances, so there's no follow-up per-group fetch (that was a
    // request waterfall: the ranking call couldn't start until this one
    // resolved — an extra full round trip on every homepage load).
    const groupsPromise = fetch(`/api/groups?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setGroups(json.data);
          // Only default to the first group on initial load — a refresh
          // shouldn't yank the picker back to index 0 mid-selection.
          setSelectedGroupId((prev) => prev || json.data[0]?.id || "");
        } else {
          setError((prev) => prev || json.error || "Failed to load groups");
        }
      })
      .catch(() => setError((prev) => prev || "Failed to connect to the server"))
      .finally(() => setLoading(false));

    return Promise.all([balancePromise, groupsPromise]);
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

  // Member balances come straight from the groups payload — switching groups
  // in the picker is instant, no fetch.
  const memberBalances =
    groups.find((g) => g.id === selectedGroupId)?.memberBalances ?? null;

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full" />
      </main>
    );
  }

  if (!user) {
    // AppShell renders the login screen before any page mounts signed-out;
    // reaching here means the cache was cleared mid-session — just blank out.
    return null;
  }

  return (
    <PullToRefresh onRefresh={() => loadData(user)}>
    <main className="min-h-dvh px-4 pt-2 pb-24 max-w-lg mx-auto">
      {/* Greeting */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ink-muted">Hello, {user.name}</h1>
        </div>
        <UserAvatar name={user.name} size="md" />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-negative-tint border border-negative-soft rounded-xl text-sm text-negative">
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
                    balance.netBalance >= 0 ? 'border-hairline' : 'border-negative-soft'
                  }`}
                  style={{
                    background: balance.netBalance >= 0
                      ? 'var(--color-surface)'
                      : 'linear-gradient(135deg, rgba(254,226,226,0.4) 0%, rgba(253,242,242,0.3) 100%)',
                    boxShadow: '0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)'
                  }}
                >
                  {/* Ambient state: cash rains when you're up, Gandhi falls
                      when you're down. Genuinely square gets the PAID
                      watermark instead of the blank card it used to show. */}
                  {isSettled(balance) ? (
                    <PaidStamp />
                  ) : balance.netBalance > 0 ? (
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

                  <p className="text-sm text-ink-muted uppercase tracking-wider mb-2 relative z-10">
                    {isSettled(balance)
                      ? "ALL SQUARE"
                      : balance.netBalance >= 0
                      ? "UP GOOD"
                      : "DOWN BAD"}
                  </p>
                  <p className={`text-4xl font-bold ${balance.netBalance >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"} relative z-10`}>
                    {balance.netBalance >= 0 ? "+" : "-"}${Math.abs(balance.netBalance).toFixed(2)}
                  </p>
                  {/* Net zero but debts open both ways — one transfer from
                      done, and the only state where the headline number lies. */}
                  {isNetZeroButOpen(balance) && (
                    <p className="text-footnote text-ink-muted mt-1.5 relative z-10">
                      ${(balance.totalOwed ?? 0).toFixed(2)} in, $
                      {(balance.totalOwe ?? 0).toFixed(2)} out — settle up to clear it
                    </p>
                  )}

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
          <h2 className="text-lg font-bold text-ink">Down Bad Leaderboard</h2>
        </div>

        {groups.length === 0 ? (
          <div
            className="border border-hairline rounded-xl px-5 py-8 text-center backdrop-blur-sm"
            style={{
              background: 'var(--color-surface)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.02)'
            }}
          >
            <p className="text-sm text-ink-muted mb-2">You&apos;re not in any group yet</p>
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

            <DownBadRanking ranking={memberBalances} currentUserId={user.id} />
          </>
        )}
      </div>
    </main>
    </PullToRefresh>
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
  currentUserId,
}: {
  ranking: any[] | null;
  currentUserId: string;
}) {
  if (ranking === null) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 bg-canvas rounded-xl" />
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
        className="border border-hairline rounded-xl px-5 py-6 text-center backdrop-blur-sm"
        style={{
          background: 'var(--color-surface)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.02)'
        }}
      >
        <p className="text-sm text-ink-muted font-medium">No one is down bad 🎉</p>
        <p className="text-xs text-ink-muted mt-1">Everyone in this group is settled</p>
      </div>
    );
  }

  return (
    <div
      className="border border-hairline rounded-xl p-5 backdrop-blur-sm"
      style={{
        background: 'var(--color-surface)',
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
              <span className={`text-sm font-semibold w-20 truncate z-10 ${isYou ? "text-[var(--primary)]" : "text-ink"}`}>
                {isYou ? "You" : entry.user.name}
              </span>

              {/* Background bar container - centered */}
              <div className="absolute left-20 right-20 h-6 flex items-center">
                {/* Center reference line (subtle) */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-canvas -translate-x-1/2" />

                {/* Bar track with inset shadow */}
                <div className="absolute left-0 right-0 top-1 bottom-1 bg-canvas/50 rounded-sm"
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

