"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BalanceCard from "@/components/BalanceCard";
import UserAvatar from "@/components/UserAvatar";
import TransactionCard from "@/components/TransactionCard";
import { getSessionUser } from "@/lib/session";
import type { BalanceSummary } from "@/lib/actions/balances";

/**
 * Home page — dashboard with balance summary, quick actions,
 * top debtor/creditor highlights, and recent activity.
 */
export default function HomePage() {
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
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

    // Fetch balance
    fetch(`/api/balances?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setBalance(json.data);
        else setError(json.error || "Failed to load balance");
      })
      .catch(() => setError("Failed to connect to the server"));

    // Fetch recent transactions
    fetch(`/api/transactions?userId=${currentUser.id}&limit=5`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setRecentTransactions(json.data);
        else setError((prev) => prev || json.error || "Failed to load transactions");
      })
      .catch(() => setError((prev) => prev || "Failed to connect to the server"))
      .finally(() => setLoading(false));
  }, []);

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
          <p className="text-xs text-gray-400">Here&apos;s your balance</p>
        </div>
        <UserAvatar name={user.name} size="md" />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          ⚠ {error}
        </div>
      )}

      {/* Balance card */}
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
          href="/settle-up"
          className="flex-1 px-4 py-3 text-sm font-semibold text-[var(--primary)] border border-[var(--primary)] rounded-xl hover:bg-blue-50 text-center transition-colors"
        >
          Settle up
        </Link>
      </div>

      {/* Top debtor / creditor highlights */}
      {balance && (
        <div className="mt-6 space-y-3">
          {balance.topDebtor && (
            <HighlightCard
              user={balance.topDebtor.user}
              amount={balance.topDebtor.amount}
              label="owes you the most"
              type="positive"
            />
          )}
          {balance.topCreditor && (
            <HighlightCard
              user={balance.topCreditor.user}
              amount={Math.abs(balance.topCreditor.amount)}
              label="you owe the most"
              type="negative"
            />
          )}
        </div>
      )}

      {/* Recent activity */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Recent Activity</h2>
          <Link href="/transactions" className="text-xs text-[var(--primary)] font-medium">
            See all
          </Link>
        </div>
        <div className="space-y-2">
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No transactions yet. Start by scanning a receipt!
            </p>
          ) : (
            recentTransactions.map((tx: any) => (
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
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}

/** Highlight card for top debtor / creditor */
function HighlightCard({
  user,
  amount,
  label,
  type,
}: {
  user: { id: string; name: string };
  amount: number;
  label: string;
  type: "positive" | "negative";
}) {
  const href = `/transactions?with=${user.id}`;
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:bg-gray-50 transition-colors"
    >
      <UserAvatar name={user.name} size="sm" />
      <div className="flex-1">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900">{user.name}</p>
      </div>
      <p className={`text-sm font-bold ${
        type === "positive" ? "text-[var(--success)]" : "text-[var(--danger)]"
      }`}>
        {type === "positive" ? "+" : "-"}${amount.toFixed(2)}
      </p>
    </Link>
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
