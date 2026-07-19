"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import ErrorDialog from "@/components/ErrorDialog";
import { getSessionUser } from "@/lib/session";

/**
 * Group settle-up — the minimum-transfer plan that clears every balance
 * in the group, with Mark-paid buttons on the payments you're part of.
 */
export default function GroupSettleUpPage() {
  const params = useParams();
  const groupId = params.id as string;

  const [user, setUser] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [plan, setPlan] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<{ title: string; message: string } | null>(null);

  const loadData = useCallback((currentUser: any) => {
    fetch(`/api/groups/${groupId}?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setGroup(json.data);
          setPlan(json.data.transferPlan ?? []);
        } else {
          setError(json.error || "Failed to load group");
        }
      })
      .catch(() => setError("Failed to connect to the server"))
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

  const handleMarkPaid = useCallback(
    async (fromUserId: string, toUserId: string, amount: number) => {
      setSettling(`${fromUserId}-${toUserId}`);
      try {
        const response = await fetch("/api/settlements/mark-paid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromUserId, toUserId, amount, groupId }),
        });
        const json = await response.json();
        if (json.success) {
          setMessage("Marked as paid!");
          setTimeout(() => window.location.reload(), 1200);
        } else {
          setDialogError({
            title: "Payment failed",
            message: json.error || "Failed to record payment. Please try again.",
          });
        }
      } catch {
        setDialogError({ title: "Payment failed", message: "Failed to connect to the server." });
      } finally {
        setSettling(null);
      }
    },
    [groupId]
  );

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

  return (
    <main className="min-h-dvh px-4 pt-6 pb-24 max-w-lg mx-auto">
      <Link
        href={`/groups/${groupId}`}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 block"
      >
        ← {group?.name ?? "Group"}
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Settle Up</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Fewest payments to clear the whole group
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          ⚠ {error}
        </div>
      )}

      {message && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {message}
        </div>
      )}

      {plan.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-sm text-gray-500 font-medium">All settled up!</p>
          <p className="text-xs text-gray-400 mt-1">No outstanding balances in this group</p>
        </div>
      ) : (
        <div className="space-y-2">
          {plan.map((t: any) => {
            const key = `${t.fromUser.id}-${t.toUser.id}`;
            const youPay = t.fromUser.id === user.id;
            const youReceive = t.toUser.id === user.id;
            return (
              <div
                key={key}
                className="flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl"
              >
                <UserAvatar name={t.fromUser.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{youPay ? "You" : t.fromUser.name}</span>
                    <span className="text-gray-400"> pays </span>
                    <span className="font-medium">{youReceive ? "you" : t.toUser.name}</span>
                  </p>
                  <p className={`text-xs font-semibold ${
                    youReceive ? "text-[var(--success)]" : youPay ? "text-[var(--danger)]" : "text-gray-500"
                  }`}>
                    ${t.amount.toFixed(2)}
                  </p>
                </div>
                {youPay && (
                  <Link
                    href={`/payments/new?groupId=${groupId}&toUserId=${t.toUser.id}&amount=${t.amount}`}
                    className="px-3 py-1.5 text-xs font-medium text-white rounded-lg hover:opacity-90 transition-opacity bg-[var(--danger)]"
                  >
                    💸 Pay
                  </Link>
                )}
                {youReceive && (
                  <button
                    onClick={() => handleMarkPaid(t.fromUser.id, t.toUser.id, t.amount)}
                    disabled={settling === key}
                    className="px-3 py-1.5 text-xs font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity bg-[var(--success)]"
                  >
                    {settling === key ? "..." : "Mark paid"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
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
