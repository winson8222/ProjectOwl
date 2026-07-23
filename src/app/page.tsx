"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BalanceCard from "@/components/BalanceCard";
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
    // AppShell renders the login screen before any page mounts signed-out;
    // reaching here means the cache was cleared mid-session — just blank out.
    return null;
  }

  return (
    <main className="min-h-dvh px-4 pt-2 pb-24 max-w-lg mx-auto">
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
            {/* Group scroll wheel picker */}
            <GroupPickerWheel
              groups={groups}
              selectedGroupId={selectedGroupId}
              onGroupChange={(groupId) => setSelectedGroupId(groupId)}
            />

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

