"use client";

import { useState } from "react";

interface Step3b_ManualExpenseDetailsProps {
  amount: number;
  setAmount: (amount: number) => void;
  date: string;
  setDate: (date: string) => void;
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  groups: any[];
  user: any;
  onNext: () => void;
  onBack: () => void;
  title: string;
  setTitle: (title: string) => void;
}

/**
 * Step 3b (Expense + Manual): Core expense details
 */
export default function Step3b_ManualExpenseDetails({
  amount,
  setAmount,
  date,
  setDate,
  selectedGroupId,
  setSelectedGroupId,
  groups,
  user,
  onNext,
  onBack,
  title,
  setTitle
}: Step3b_ManualExpenseDetailsProps) {
  const [error, setError] = useState<string | null>(null);

  const isValid = amount > 0 && selectedGroupId;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 text-center mb-6">
        Tell us about this expense
      </h2>

      {/* Title */}
      <div className="rounded-xl p-4 backdrop-blur-sm"
           style={{
             background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
             border: '1px solid rgba(176,176,176,0.2)',
             boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)'
           }}>
        <label className="text-sm font-medium text-gray-700 block mb-2">What was it for?</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Dinner at restaurant, Uber ride, Groceries"
          className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
      </div>

      {/* Amount */}
      <div className="rounded-xl p-4 space-y-3 backdrop-blur-sm"
           style={{
             background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
             border: '1px solid rgba(176,176,176,0.2)',
             boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)'
           }}>
        <label className="text-sm font-medium text-gray-700">Total amount</label>
        <div className="flex items-center gap-2">
          <span className="text-2xl text-gray-400">$</span>
          <input
            type="number"
            value={amount || ""}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="flex-1 text-2xl font-bold text-gray-900 px-3 py-2 border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            step="0.01"
            min="0"
          />
        </div>
      </div>

      {/* Date */}
      <div className="rounded-xl p-4 backdrop-blur-sm"
           style={{
             background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
             border: '1px solid rgba(176,176,176,0.2)',
             boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)'
           }}>
        <label className="text-sm font-medium text-gray-700 block mb-2">Date</label>
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
               background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
               border: '1px solid rgba(176,176,176,0.2)',
               boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)'
             }}>
          <label className="text-sm font-medium text-gray-700 block mb-2">Group</label>
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
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          ⚠ {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-3 text-sm font-medium text-gray-600 rounded-xl backdrop-blur-sm transition-all"
          style={{
            border: '1px solid rgba(176,176,176,0.2)',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(248,250,252,0.2) 100%)'
          }}
        >
          ← Back
        </button>
        <button
          onClick={() => {
            if (!isValid) {
              setError("Please enter amount and select a group");
              return;
            }
            onNext();
          }}
          disabled={!isValid}
          className="flex-1 px-4 py-3 text-sm font-semibold text-white rounded-xl backdrop-blur-sm transition-all disabled:opacity-50"
          style={{
            background: isValid
              ? 'linear-gradient(135deg, rgba(58,133,197,0.9) 0%, rgba(42,107,165,0.85) 100%)'
              : 'linear-gradient(135deg, rgba(176,176,176,0.3) 0%, rgba(176,176,176,0.2) 100%)',
            border: '1px solid rgba(58,133,197,0.4)',
            boxShadow: isValid
              ? '0 2px 4px rgba(58,133,197,0.2), 0 4px 8px rgba(58,133,197,0.15)'
              : 'none'
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
