"use client";

import { useState } from "react";
import { ScanDiagram } from "./TypeDiagrams";

interface Step3_ScanDetailsProps {
  title: string;
  setTitle: (title: string) => void;
  date: string;
  setDate: (date: string) => void;
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  groups: any[];
  amount: number;
  onNext: () => void;
  onBack: () => void;
}

/**
 * Step 3 (Expense + Scan): Name and categorize the expense
 * Amount is pre-filled from scan, just need title, group, date
 */
export default function Step3_ScanDetails({
  title,
  setTitle,
  date,
  setDate,
  selectedGroupId,
  setSelectedGroupId,
  groups,
  amount,
  onNext,
  onBack
}: Step3_ScanDetailsProps) {
  const [error, setError] = useState<string | null>(null);

  const isValid = title && (selectedGroupId || groups.length === 0);

  return (
    <div className="space-y-4">
      <h2 className="text-title2 font-bold text-ink mb-6">Name this expense</h2>

      {/* What ItreAI read off the receipt */}
      <div
        className="rounded-[14px] p-4 mb-5"
        style={{
          background: "var(--color-blueberry-100)",
          border: "1px solid var(--color-hairline)",
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="shrink-0 flex items-center justify-center rounded-[10px] text-white"
            style={{
              width: 48,
              height: 48,
              background: "var(--color-blueberry-600)",
            }}
          >
            <ScanDiagram />
          </span>
          <div>
            <div className="text-footnote text-ink-muted">
              Total read from your receipt
            </div>
            <div
              className="text-title1 font-bold tabular"
              style={{ color: "var(--color-blueberry-600)" }}
            >
              ${amount && amount > 0 ? amount.toFixed(2) : "0.00"}
            </div>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="rounded-xl p-4 backdrop-blur-sm"
           style={{
             background: 'var(--color-surface)',
             border: '1px solid var(--color-hairline)',
             boxShadow: '0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)'
           }}>
        <label className="text-sm font-medium text-ink block mb-2">What was it for?</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Dinner at restaurant, Groceries"
          className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
      </div>

      {/* Date */}
      <div className="rounded-xl p-4 backdrop-blur-sm"
           style={{
             background: 'var(--color-surface)',
             border: '1px solid var(--color-hairline)',
             boxShadow: '0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)'
           }}>
        <label className="text-sm font-medium text-ink block mb-2">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
      </div>

      {/* Group */}
      {groups.length > 0 && (
        <div className="rounded-xl p-4 backdrop-blur-sm"
             style={{
               background: 'var(--color-surface)',
               border: '1px solid var(--color-hairline)',
               boxShadow: '0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)'
             }}>
          <label className="text-sm font-medium text-ink block mb-2">Group</label>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            <option value="">Select a group...</option>
            {groups.map((g: any) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-negative-tint border border-negative-soft rounded-xl text-sm text-negative">
          ⚠ {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-3 text-sm font-medium text-ink-muted rounded-xl backdrop-blur-sm transition-all"
          style={{
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-surface)'
          }}
        >
          ← Back
        </button>
        <button
          onClick={() => {
            if (!isValid) {
              setError("Please enter a name and select a group");
              return;
            }
            onNext();
          }}
          disabled={!isValid}
          className="flex-1 px-4 py-3 text-sm font-semibold text-white rounded-xl backdrop-blur-sm transition-all disabled:opacity-50"
          style={{
            background: isValid
              ? 'var(--color-blueberry-600)'
              : 'var(--color-hairline)',
            border: '1px solid var(--color-blueberry-700)',
            boxShadow: isValid
              ? '0 2px 6px color-mix(in srgb, var(--color-blueberry-900) 22%, transparent)'
              : 'none'
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
