"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import TransactionCard from "@/components/TransactionCard";
import UserAvatar from "@/components/UserAvatar";
import { getSessionUser } from "@/lib/session";

/**
 * Transaction list page with payer/payee filters.
 * Supports deep-linking via ?with=userId for highlight taps.
 */
export default function TransactionsPage() {
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [payer, setPayer] = useState<string>("");
  const [payees, setPayees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setUser(currentUser);
    setPayees([currentUser.id]);

    // Load all users for filter dropdowns
    fetch("/api/users")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setUsers(json.data);
        else setError(json.error || "Failed to load users");
      })
      .catch(() => setError("Failed to connect to the server"));
  }, []);

  useEffect(() => {
    if (!user) return;

    const params = new URLSearchParams({ userId: user.id });
    if (payer) params.set("payer", payer);
    if (payees.length > 0) params.set("payees", payees.join(","));

    fetch(`/api/transactions?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setTransactions(json.data);
        else setError(json.error || "Failed to load transactions");
      })
      .catch(() => setError("Failed to connect to the server"))
      .finally(() => setLoading(false));
  }, [user, payer, payees]);

  if (!user) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <p className="text-sm text-gray-500">Please select a user from the home page first.</p>
      </main>
    );
  }

  const togglePayee = (uid: string) => {
    if (payees.includes(uid)) {
      if (payees.length > 1) {
        setPayees(payees.filter((id) => id !== uid));
      }
    } else {
      setPayees([...payees, uid]);
    }
  };

  return (
    <main className="min-h-dvh px-4 pt-6 pb-24 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Transactions</h1>
        <Link
          href="/transactions/new"
          className="text-sm font-semibold text-[var(--primary)] px-3 py-1.5 border border-[var(--primary)] rounded-lg hover:bg-blue-50"
        >
          + New
        </Link>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          ⚠ {error}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3 mb-4">
        {/* Payer filter */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Paid by</label>
          <select
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            <option value="">Anyone</option>
            <option value={user.id}>You</option>
            {users.filter((u) => u.id !== user.id).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {/* Payees filter */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Involving</label>
          <div className="flex flex-wrap gap-1.5">
            {users.map((u) => {
              const selected = payees.includes(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => togglePayee(u.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                    selected
                      ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                      : "bg-white text-gray-500 border-[var(--border)] hover:border-gray-300"
                  }`}
                >
                  {u.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Transaction list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-6 h-6 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400 mb-2">No transactions found</p>
            <Link
              href="/transactions/new"
              className="text-sm font-medium text-[var(--primary)]"
            >
              Create your first transaction
            </Link>
          </div>
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
    </main>
  );
}
