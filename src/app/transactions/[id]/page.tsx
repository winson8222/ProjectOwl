"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import ConfirmDialog from "@/components/ConfirmDialog";
import { getSessionUser } from "@/lib/session";

/**
 * Transaction detail page — itemized breakdown, per-person totals,
 * paid-by badge, settle-up action, edit/delete.
 */
export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [tx, setTx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setUser(currentUser);

    fetch(`/api/transactions?id=${params.id}&userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          // getTransaction singular returns data directly
          setTx(json.data);
        } else if (json.data) {
          setTx(json.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleDelete = useCallback(async () => {
    try {
      const response = await fetch(`/api/transactions?id=${params.id}`, {
        method: "DELETE",
      });
      const json = await response.json();
      if (json.success) {
        router.push("/transactions");
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
    setShowDeleteDialog(false);
  }, [params.id, router]);

  const handleMarkSettled = useCallback(async () => {
    // For now, create a settlement record for each participant who owes
    if (!user || !tx) return;

    for (const participant of tx.participants || []) {
      if (participant.user.id === tx.paidByUserId) continue; // skip payer
      const amount = participant.shareAmount;
      if (amount <= 0) continue;

      await fetch("/api/settlements/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settlementId: `settlement-${params.id}-${participant.user.id}`,
        }),
      });
    }

    // Reload
    window.location.reload();
  }, [user, tx, params.id]);

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full" />
      </main>
    );
  }

  if (!tx) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <p className="text-sm text-gray-500">Transaction not found</p>
      </main>
    );
  }

  const isPayer = user?.id === tx.paidByUserId;

  return (
    <main className="min-h-dvh px-4 pt-6 pb-8 max-w-lg mx-auto">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 block"
      >
        ← Back
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{tx.title}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-400">
            {new Date(tx.transactionDate).toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric", year: "numeric",
            })}
          </span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400">
            {isPayer ? "You paid" : `${tx.paidByUser?.name ?? "Someone"} paid`}
          </span>
        </div>
      </div>

      {/* Itemized breakdown (with scan assignments if available) */}
      {tx.items && tx.items.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-2.5 border-b border-[var(--border)] bg-gray-50">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Items</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {tx.items.map((item: any, i: number) => {
              // Find assignments for this item
              const itemAssignments = (tx.itemAssignments ?? []).filter(
                (a: any) => a.itemId === item.id
              );
              return (
                <div key={i} className="px-4 py-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-900 font-medium">
                      {item.name}
                      {item.quantity > 1 && (
                        <span className="text-gray-400"> ×{item.quantity}</span>
                      )}
                    </span>
                    <span className="font-mono text-gray-700">
                      ${item.price.toFixed(2)}
                    </span>
                  </div>
                  {/* Show item assignments */}
                  {itemAssignments.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {itemAssignments.map((a: any) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"
                        >
                          <UserAvatar name={a.userName} size="sm" />
                          {a.userName.split(" ")[0]}
                          <span className="font-mono text-gray-400">
                            ${a.shareAmount.toFixed(2)}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-person totals */}
      {tx.participants && tx.participants.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-2.5 border-b border-[var(--border)] bg-gray-50">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Split</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {tx.participants.map((p: any) => (
              <div key={p.user.id} className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserAvatar name={p.user.name} size="sm" />
                  <span className="text-sm text-gray-700">
                    {p.user.name}
                    {p.user.id === tx.paidByUserId && (
                      <span className="ml-1.5 text-[10px] text-[var(--primary)] bg-blue-50 px-1.5 py-0.5 rounded-full font-medium">
                        paid
                      </span>
                    )}
                  </span>
                </div>
                <span className="text-sm font-mono font-medium text-gray-900">
                  ${p.shareAmount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-[var(--border)] bg-gray-50 flex justify-between">
            <span className="text-sm font-semibold text-gray-700">Total</span>
            <span className="text-sm font-mono font-bold text-gray-900">${tx.totalAmount.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={handleMarkSettled}
          className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-[var(--success)] rounded-xl hover:opacity-90 transition-opacity"
        >
          Mark as settled
        </button>
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="w-full px-4 py-2.5 text-sm font-medium text-[var(--danger)] border border-[var(--danger)] rounded-xl hover:bg-red-50 transition-colors"
        >
          Delete transaction
        </button>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        title="Delete transaction?"
        message={`Are you sure you want to delete "${tx.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </main>
  );
}
