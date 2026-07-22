"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import ErrorDialog from "@/components/ErrorDialog";
import LoadingOverlay from "@/components/LoadingOverlay";
import { getSessionUser } from "@/lib/session";
import { ERROR_MESSAGES, mapErrorMessage } from "@/lib/constants";

/**
 * Record a payment — a transaction of type "payment" that pays another
 * group member a specified amount, reducing what you owe them.
 *
 * Deliberately styled differently from the expense form (green money-transfer
 * look, big centered amount) so it's obvious you're paying someone, not
 * splitting a cost.
 *
 * Deep-link prefills: /payments/new?groupId=xxx&toUserId=yyy&amount=12.34
 * (used by the "Pay" shortcuts on transactions and group settle-up).
 */
export default function NewPaymentPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Slide-up animation on mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [groups, setGroups] = useState<any[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [toUserId, setToUserId] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // The group's minimal-transfer settle-up plan, shown as a reference next to
  // the chosen recipient — same numbers as the group settle-up page.
  const [plan, setPlan] = useState<any[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<{ title: string; message: string } | null>(null);
  const [showAllErrors, setShowAllErrors] = useState(false);
  // Prefill from query params, applied once groups load.
  const [prefillToUserId, setPrefillToUserId] = useState<string | null>(null);

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) return;
    setUser(currentUser);

    const params = new URLSearchParams(window.location.search);
    const requestedGroupId = params.get("groupId");
    const requestedToUserId = params.get("toUserId");
    const requestedAmount = parseFloat(params.get("amount") ?? "");
    if (requestedToUserId) setPrefillToUserId(requestedToUserId);
    if (!isNaN(requestedAmount) && requestedAmount > 0) {
      setAmount(Math.round(requestedAmount * 100) / 100);
    }

    fetch(`/api/groups?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setGroups(json.data);
          const match = json.data.find((g: any) => g.id === requestedGroupId);
          setSelectedGroupId(match?.id ?? json.data[0]?.id ?? "");
        } else {
          setError(json.error || "Failed to load groups");
        }
      })
      .catch(() => setError("Failed to connect to the server"))
      .finally(() => setGroupsLoaded(true));
  }, []);

  const group = groups.find((g) => g.id === selectedGroupId);
  const recipients = (group?.members ?? []).filter((m: any) => m.id !== user?.id);

  // Load the group's settle-up plan for the owe/owed reference.
  useEffect(() => {
    if (!user || !selectedGroupId) return;
    setPlan([]);
    fetch(`/api/groups/${selectedGroupId}?userId=${user.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setPlan(json.data.transferPlan ?? []);
      })
      .catch(() => {}); // reference only — the form still works without it
  }, [user, selectedGroupId]);

  // Keep the recipient valid for the selected group; apply the deep-link
  // prefill when it matches a member.
  useEffect(() => {
    if (!group) return;
    const memberIds = new Set(recipients.map((m: any) => m.id));
    if (prefillToUserId && memberIds.has(prefillToUserId)) {
      setToUserId(prefillToUserId);
    } else if (toUserId && !memberIds.has(toUserId)) {
      setToUserId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, groups, prefillToUserId]);

  const handleSave = async () => {
    setShowAllErrors(true);
    if (!user || !selectedGroupId || !toUserId || amount <= 0) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Payment",
          type: "payment",
          totalAmount: amount,
          paidByUserId: user.id,
          groupId: selectedGroupId,
          transactionDate: date,
          participants: [{ userId: toUserId, shareAmount: amount }],
        }),
      });
      const json = await response.json();
      if (json.success) {
        window.location.href = "/activity";
      } else {
        setDialogError({
          title: "Payment failed",
          message: json.error || ERROR_MESSAGES.FAILED_TO_SAVE,
        });
      }
    } catch (err) {
      setDialogError({ title: "Payment failed", message: mapErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <p className="text-sm text-gray-500">Please select a user from the home page first.</p>
      </main>
    );
  }

  const recipient = recipients.find((m: any) => m.id === toUserId);
  // Reference from the simplified settle-up plan (matches the settle-up page).
  const youOweRecipient = recipient
    ? plan.find((t) => t.fromUser?.id === user?.id && t.toUser?.id === recipient.id)?.amount ?? 0
    : 0;
  const recipientOwesYou = recipient
    ? plan.find((t) => t.fromUser?.id === recipient.id && t.toUser?.id === user?.id)?.amount ?? 0
    : 0;

  return (
    <main
      className={`min-h-dvh px-4 pt-6 pb-8 max-w-lg mx-auto transition-all duration-700 ease-out ${
        isMounted ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      }`}
    >
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 block"
      >
        ← Back
      </button>

      {/* Green money-transfer hero — visually distinct from the expense form */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white px-5 py-5 mb-6 shadow-md">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-2xl">💸</span> Record a Payment
        </h1>
        <p className="text-sm text-white/85 mt-1">
          Pay someone back — this reduces what you owe them
        </p>
      </div>

      {groupsLoaded && groups.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-8 text-center">
          <p className="text-sm text-gray-500 mb-2">
            Payments happen within a group — you&apos;re not in any yet.
          </p>
          <button
            onClick={() => (window.location.href = "/groups")}
            className="text-sm font-medium text-[var(--primary)]"
          >
            Create a group first →
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── You → recipient visual ─────────────────────────────── */}
          <div className="flex items-center justify-center gap-5 py-2">
            <div className="flex flex-col items-center gap-1.5">
              <UserAvatar name={user.name} size="lg" />
              <span className="text-xs font-medium text-gray-600">You</span>
            </div>
            <span className="text-2xl text-emerald-500 font-bold">→</span>
            <div className="flex flex-col items-center gap-1.5">
              {recipient ? (
                <>
                  <UserAvatar name={recipient.name} size="lg" />
                  <span className="text-xs font-medium text-gray-600">{recipient.name}</span>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300 text-xl">
                    ?
                  </div>
                  <span className="text-xs text-gray-400">Pick below</span>
                </>
              )}
            </div>
          </div>

          {/* ── Owe/owed reference from the group's settle-up plan ─── */}
          {recipient && (
            youOweRecipient > 0.005 ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700">
                  You owe <span className="font-semibold">{recipient.name}</span>{" "}
                  <span className="font-semibold">${youOweRecipient.toFixed(2)}</span>
                  {group && <span className="text-red-400"> per {group.name}&apos;s settle-up plan</span>}
                </p>
                <button
                  type="button"
                  onClick={() => setAmount(Math.round(youOweRecipient * 100) / 100)}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors shrink-0"
                >
                  Pay ${youOweRecipient.toFixed(2)}
                </button>
              </div>
            ) : recipientOwesYou > 0.005 ? (
              <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-sm text-emerald-700">
                  <span className="font-semibold">{recipient.name}</span> pays{" "}
                  <span className="font-semibold">you ${recipientOwesYou.toFixed(2)}</span>
                  {group && <span className="text-emerald-500"> in {group.name}&apos;s settle-up plan</span>} —
                  you don&apos;t owe them anything
                </p>
              </div>
            ) : (
              <div className="px-4 py-3 bg-gray-50 border border-[var(--border)] rounded-xl">
                <p className="text-sm text-gray-500">
                  Nothing to pay <span className="font-medium text-gray-700">{recipient.name}</span>
                  {group && <> in {group.name}&apos;s settle-up plan</>}
                </p>
              </div>
            )
          )}

          {/* ── Amount — big and centered ──────────────────────────── */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-5">
            <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider text-center mb-2">
              Amount
            </p>
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-semibold text-emerald-600">$</span>
              <input
                type="number"
                value={amount || ""}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-40 text-4xl font-bold text-gray-900 text-center bg-transparent focus:outline-none placeholder:text-gray-300"
              />
            </div>
            {showAllErrors && amount <= 0 && (
              <p className="text-xs text-[var(--danger)] text-center mt-2">
                Enter an amount greater than $0
              </p>
            )}
          </div>

          {/* ── Recipient ──────────────────────────────────────────── */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">Pay to</label>
            <div className="flex flex-wrap gap-2">
              {recipients.map((m: any) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setToUserId(m.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-xl border transition-colors ${
                    toUserId === m.id
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold"
                      : "border-[var(--border)] bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <UserAvatar name={m.name} size="sm" />
                  {m.name}
                </button>
              ))}
              {recipients.length === 0 && (
                <p className="text-sm text-gray-400">No other members in this group</p>
              )}
            </div>
            {showAllErrors && !toUserId && (
              <p className="text-xs text-[var(--danger)] mt-1.5">Pick who you&apos;re paying</p>
            )}
          </div>

          {/* ── Group + date (compact row) ─────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Group</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* ── Error ──────────────────────────────────────────────── */}
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          {/* ── Save ───────────────────────────────────────────────── */}
          <button
            onClick={handleSave}
            disabled={saving || !toUserId || amount <= 0}
            className="w-full px-4 py-3.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {saving
              ? "Saving..."
              : recipient
                ? `💸 Pay ${recipient.name} $${amount > 0 ? amount.toFixed(2) : "0.00"}`
                : "💸 Record payment"}
          </button>
        </div>
      )}

      {saving && <LoadingOverlay />}

      <ErrorDialog
        open={!!dialogError}
        title={dialogError?.title || "Error"}
        message={dialogError?.message || ""}
        onDismiss={() => setDialogError(null)}
      />
    </main>
  );
}
