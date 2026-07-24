"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import ConfirmDialog from "@/components/ConfirmDialog";
import ErrorDialog from "@/components/ErrorDialog";
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
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [dialogError, setDialogError] = useState<{ title: string; message: string } | null>(null);
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
        } else {
          setError(json.error || "Failed to load transaction");
        }
      })
      .catch(() => setError("Failed to connect to the server"))
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
        return;
      }
      setDialogError({
        title: "Delete failed",
        message: json.error || "Failed to delete transaction.",
      });
    } catch (err) {
      setDialogError({
        title: "Delete failed",
        message: "Failed to connect to the server.",
      });
    }
    setShowDeleteDialog(false);
  }, [params.id, router]);

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
        <p className="text-sm text-red-600">{error || "Transaction not found"}</p>
        {error && (
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 text-sm font-medium text-[var(--primary)] border border-[var(--primary)] rounded-lg hover:bg-blue-50"
          >
            Try again
          </button>
        )}
      </main>
    );
  }

  const isPayer = user?.id === tx.paidByUserId;
  const isPayment = tx.type === "payment";
  // "Pay back" shortcut: you owe a share of this expense to whoever paid it.
  const youOwe = !isPayer && !isPayment && tx.userShare > 0;

  return (
    <main className="min-h-dvh px-4 pt-6 max-w-lg mx-auto animate-slide-in-right content-with-floating-nav">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 block"
      >
        ← Back
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {isPayment && <span className="mr-1.5">💸</span>}
          {tx.title}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-400">
            {new Date(tx.transactionDate).toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric", year: "numeric",
            })}
          </span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400">
            {isPayment
              ? `${isPayer ? "You" : tx.paidByUser?.name ?? "Someone"} paid ${
                  tx.participants?.[0]?.user.id === user?.id
                    ? "you"
                    : tx.participants?.[0]?.user.name ?? "someone"
                } $${tx.totalAmount.toFixed(2)}`
              : isPayer ? "You paid" : `${tx.paidByUser?.name ?? "Someone"} paid`}
          </span>
        </div>
      </div>

      {/* Itemized breakdown (with scan assignments if available) */}
      {tx.items && tx.items.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-4 backdrop-blur-sm"
             style={{
               background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
               border: '1px solid rgba(176,176,176,0.2)',
               boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03), 0 4px 8px rgba(0,0,0,0.02)'
             }}>
          <div className="px-4 py-2.5 border-b border-[var(--border)] bg-gray-50/80">
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
        <div className="rounded-xl overflow-hidden mb-4 backdrop-blur-sm"
             style={{
               background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
               border: '1px solid rgba(176,176,176,0.2)',
               boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03), 0 4px 8px rgba(0,0,0,0.02)'
             }}>
          <div className="px-4 py-2.5 border-b border-[var(--border)] bg-gray-50/80">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Split</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {tx.participants.map((p: any) => (
              <div key={p.user.id} className="px-4 py-2.5 flex items-center justify-between backdrop-blur-sm" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(248,250,252,0.08) 100%)' }}>
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
          <div className="px-4 py-2.5 border-t border-[var(--border)] flex justify-between backdrop-blur-sm" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(248,250,252,0.12) 100%)' }}>
            <span className="text-sm font-semibold text-gray-700">Total</span>
            <span className="text-sm font-mono font-bold text-gray-900">${tx.totalAmount.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {youOwe && tx.groupId && (
          <a
            href={`/payments/new?groupId=${tx.groupId}&toUserId=${tx.paidByUserId}&amount=${tx.userShare}`}
            className="block w-full px-4 py-2.5 text-center text-sm font-semibold text-white rounded-xl backdrop-blur-sm transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, rgba(58,133,197,0.9) 0%, rgba(42,107,165,0.85) 100%)',
              border: '1px solid rgba(58,133,197,0.4)',
              boxShadow: '0 2px 4px rgba(58,133,197,0.2), 0 4px 8px rgba(58,133,197,0.15), 0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            💸 Pay {tx.paidByUser?.name ?? "them"} back ${tx.userShare.toFixed(2)}
          </a>
        )}
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="w-full px-4 py-2.5 text-sm font-medium text-[var(--danger)] rounded-xl backdrop-blur-sm transition-all hover:scale-[1.02]"
          style={{
            border: '1px solid rgba(197,66,58,0.3)',
            background: 'linear-gradient(135deg, rgba(197,66,58,0.08) 0%, rgba(197,66,58,0.04) 100%)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)'
          }}
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

      {/* Error dialog (POST action failures) */}
      <ErrorDialog
        open={!!dialogError}
        title={dialogError?.title || "Error"}
        message={dialogError?.message || ""}
        onDismiss={() => setDialogError(null)}
      />
    </main>
  );
}
