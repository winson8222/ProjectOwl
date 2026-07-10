"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReceiptUploader from "@/components/ReceiptUploader";
import LoadingOverlay from "@/components/LoadingOverlay";
import ErrorAlert from "@/components/ErrorAlert";
import UserPicker from "@/components/UserPicker";
import { getSessionUser } from "@/lib/session";
import { ERROR_MESSAGES } from "@/lib/constants";
import type { ReceiptExtractionResult, ExtractApiResponse } from "@/lib/schemas/receipt";

type PageStatus = "idle" | "uploading" | "extracted" | "assigning" | "saving" | "error";

/**
 * Scan → Review → Assign flow.
 * Reuses the existing ReceiptUploader + ReceiptResult + ReceiptUploader components.
 * After extraction, shows a review form with participant selection.
 */
export default function ScanTransactionPage() {
  const router = useRouter();
  const [status, setStatus] = useState<PageStatus>("idle");
  const [result, setResult] = useState<ReceiptExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const user = getSessionUser();

  // Editable review fields
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<{ nm: string; price: number; cnt?: number }[]>([]);
  const [paidBy, setPaidBy] = useState(user?.id ?? "");

  const handleUpload = useCallback(async (file: File) => {
    setStatus("uploading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/receipts/extract", {
        method: "POST",
        body: formData,
      });

      const json: ExtractApiResponse = await response.json();

      if (!json.success) {
        setError(json.error || ERROR_MESSAGES.UNKNOWN);
        setStatus("error");
        return;
      }

      setResult(json.data);
      setItems(json.data.menu);
      setTitle(`Receipt — ${new Date().toLocaleDateString()}`);
      if (user) setSelectedParticipants([user.id]);
      setStatus("extracted");
    } catch (err) {
      setError(err instanceof Error ? err.message : ERROR_MESSAGES.FAILED_TO_CONNECT);
      setStatus("error");
    }
  }, [user]);

  const updateItem = (index: number, field: "nm" | "price", value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const deleteItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { nm: "", price: 0, cnt: 1 }]);
  };

  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);

    const totalAmount = items.reduce((sum, i) => sum + i.price, 0);

    // Items are just the receipt line items now — descriptive only.
    const transactionItems = items.map((item) => ({
      name: item.nm,
      quantity: item.cnt ?? 1,
      price: item.price,
    }));

    // Split the whole receipt evenly among participants.
    // Handle rounding: last participant gets the penny difference.
    const rawShare = totalAmount / selectedParticipants.length;
    const rounded = Math.round(rawShare * 100) / 100;
    const transactionParticipants = selectedParticipants.map((uid, idx) => ({
      userId: uid,
      shareAmount: idx === selectedParticipants.length - 1
        ? Math.round((totalAmount - rounded * (selectedParticipants.length - 1)) * 100) / 100
        : rounded,
    }));

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          totalAmount,
          paidByUserId: paidBy,
          transactionDate: new Date().toISOString().split("T")[0],
          items: transactionItems,
          participants: transactionParticipants,
        }),
      });

      const json = await response.json();
      if (json.success) {
        window.location.href = "/transactions";
      } else {
        setError(json.error || ERROR_MESSAGES.FAILED_TO_SAVE);
        setStatus("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : ERROR_MESSAGES.UNKNOWN);
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }, [user, title, items, selectedParticipants, paidBy, router]);

  const handleRetry = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
    setItems([]);
  }, []);

  if (!user) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <p className="text-sm text-gray-500">Please select a user from the home page first.</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-4 pt-6 pb-8 max-w-lg mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 block"
      >
        ← Back
      </button>

      {/* Step 1: Upload */}
      {status === "idle" && (
        <>
          <h1 className="text-xl font-bold text-gray-900 mb-4">Scan a Receipt</h1>
          <ReceiptUploader onUpload={handleUpload} disabled={false} />
        </>
      )}

      {/* Step 2: Review */}
      {status === "extracted" && result && (
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Review Receipt</h1>

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-500">Items</label>
              <button
                onClick={addItem}
                className="text-xs font-medium text-[var(--primary)]"
              >
                + Add item
              </button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.nm}
                  onChange={(e) => updateItem(i, "nm", e.target.value)}
                  placeholder="Item name"
                  className="flex-1 px-2 py-1.5 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                <input
                  type="number"
                  value={item.price}
                  onChange={(e) => updateItem(i, "price", parseFloat(e.target.value) || 0)}
                  step="0.01"
                  min="0"
                  className="w-20 px-2 py-1.5 text-sm text-right border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                <button
                  onClick={() => deleteItem(i)}
                  className="text-xs text-[var(--danger)] px-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Paid by */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Paid by</label>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <option value={user.id}>You</option>
              {/* Other users from the picker could go here */}
            </select>
          </div>

          {/* Participants */}
          <UserPicker
            selectedUserIds={selectedParticipants}
            onChange={setSelectedParticipants}
            label="Split with"
          />

          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total items</span>
              <span className="font-semibold">${items.reduce((s, i) => s + i.price, 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500">Split {selectedParticipants.length} ways</span>
              <span className="font-semibold">${(items.reduce((s, i) => s + i.price, 0) / Math.max(1, selectedParticipants.length)).toFixed(2)} each</span>
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || selectedParticipants.length === 0 || items.length === 0}
            className="w-full px-4 py-3 text-sm font-semibold text-white bg-[var(--primary)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save transaction"}
          </button>
        </div>
      )}

      {/* Error */}
      {status === "error" && error && (
        <div className="mt-6">
          <ErrorAlert message={error} onRetry={handleRetry} />
        </div>
      )}

      {/* Loading */}
      {status === "uploading" && <LoadingOverlay />}
      {saving && <LoadingOverlay />}
    </main>
  );
}
