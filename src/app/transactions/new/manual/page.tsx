"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import UserPicker from "@/components/UserPicker";
import SplitInput from "@/components/SplitInput";
import { getSessionUser } from "@/lib/session";
import { ERROR_MESSAGES } from "@/lib/constants";

/**
 * Manual entry page — description, total, date, participants, split method.
 */
export default function ManualTransactionPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [splitMode, setSplitMode] = useState<"even" | "custom">("even");
  const [splitValues, setSplitValues] = useState<Record<string, number>>({});
  const [paidBy, setPaidBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participantsMeta, setParticipantsMeta] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) return;
    setUser(currentUser);
    setPaidBy(currentUser.id);

    // Auto-include the current user in the split
    setSelectedParticipants([currentUser.id]);

    // Load participant names for SplitInput
    fetch("/api/users")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setParticipantsMeta(json.data);
        }
      })
      .catch(console.error);
  }, []);

  // Auto-split when participants or total changes (even mode only)
  useEffect(() => {
    if (splitMode === "even" && selectedParticipants.length > 0 && totalAmount > 0) {
      const evenAmount = Math.round((totalAmount / selectedParticipants.length) * 100) / 100;
      const remainder = Math.round((totalAmount - evenAmount * selectedParticipants.length) * 100) / 100;
      const newValues: Record<string, number> = {};
      selectedParticipants.forEach((pid, i) => {
        newValues[pid] = i === selectedParticipants.length - 1
          ? Math.round((evenAmount + remainder) * 100) / 100
          : evenAmount;
      });
      setSplitValues(newValues);
    }
  }, [splitMode, selectedParticipants, totalAmount]);

  const handleSave = useCallback(async () => {
    if (!user || !title || totalAmount <= 0 || selectedParticipants.length === 0) return;
    setSaving(true);
    setError(null);

    // Validate custom split totals before sending
    if (splitMode === "custom") {
      const splitTotal = Object.values(splitValues).reduce((s, v) => s + v, 0);
      if (Math.abs(splitTotal - totalAmount) > 0.01) {
        setError(ERROR_MESSAGES.TX_SPLIT_MISMATCH(splitTotal.toFixed(2), totalAmount.toFixed(2)));
        setSaving(false);
        return;
      }
    }

    // Build the transaction payload
    const transactionItems = [
      {
        name: title,
        quantity: 1,
        price: totalAmount,
        assignments: selectedParticipants.map((pid) => ({
          userId: pid,
          shareAmount: splitValues[pid] ?? (totalAmount / selectedParticipants.length),
        })),
      },
    ];

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          totalAmount,
          paidByUserId: paidBy,
          transactionDate: date,
          items: transactionItems,
        }),
      });

      const json = await response.json();
      if (json.success) {
        window.location.href = "/transactions";
      } else {
        setError(json.error || ERROR_MESSAGES.FAILED_TO_SAVE);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : ERROR_MESSAGES.UNKNOWN);
    } finally {
      setSaving(false);
    }
  }, [user, title, totalAmount, date, selectedParticipants, splitValues, splitMode, paidBy, router]);

  if (!user) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <p className="text-sm text-gray-500">Please select a user from the home page first.</p>
      </main>
    );
  }

  const canSave = title.trim().length > 0 && totalAmount > 0 && selectedParticipants.length > 0 && !saving;

  return (
    <main className="min-h-dvh px-4 pt-6 pb-8 max-w-lg mx-auto">
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 block"
      >
        ← Back
      </button>

      <h1 className="text-xl font-bold text-gray-900 mb-6">Manual Entry</h1>

      <div className="space-y-5">
        {/* Description */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Movie tickets, Groceries"
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>

        {/* Total */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Total amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
            <input
              type="number"
              value={totalAmount || ""}
              onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
              step="0.01"
              min="0"
              placeholder="0.00"
              className="w-full pl-7 pr-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>

        {/* Participants */}
        <UserPicker
          selectedUserIds={selectedParticipants}
          onChange={setSelectedParticipants}
          label="Who's involved?"
        />

        {/* Split method (only when participants selected) */}
        {selectedParticipants.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">Split</label>
            <SplitInput
              participants={participantsMeta.filter((p) => selectedParticipants.includes(p.id))}
              totalAmount={totalAmount}
              values={splitValues}
              onChange={setSplitValues}
              mode={splitMode}
              onModeChange={setSplitMode}
            />
          </div>
        )}

        {/* Paid by */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Paid by</label>
          <select
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            <option value={user.id}>You</option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="w-full px-4 py-3 text-sm font-semibold text-white bg-[var(--primary)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : "Save transaction"}
        </button>
      </div>
    </main>
  );
}
