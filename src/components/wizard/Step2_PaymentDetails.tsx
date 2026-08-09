"use client";

import { useState, useEffect } from "react";
import { PaymentDiagram } from "./TypeDiagrams";

interface Step2_PaymentDetailsProps {
  amount: number;
  setAmount: (amount: number) => void;
  date: string;
  setDate: (date: string) => void;
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  toUserId: string;
  setToUserId: (id: string) => void;
  groups: any[];
  recipients: any[];
  user: any;
  onNext: () => void;
  onBack: () => void;
}

/**
 * Step 2b (Payment): Core payment details
 */
export default function Step2_PaymentDetails({
  amount,
  setAmount,
  date,
  setDate,
  selectedGroupId,
  setSelectedGroupId,
  toUserId,
  setToUserId,
  groups,
  recipients,
  user,
  onNext,
  onBack
}: Step2_PaymentDetailsProps) {
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Wait for user data to load
  useEffect(() => {
    if (user && recipients.length > 0) {
      setIsReady(true);
    }
  }, [user, recipients]);

  // Find recipient name for display
  const recipient = recipients.find((r: any) => r.id === toUserId);
  const youOweRecipient = recipient
    ? 0 // Would calculate from settle-up plan
    : 0;

  // Filter out current user from recipient list (you don't pay yourself)
  const availableRecipients = recipients.filter((r: any) => r.id !== user?.id);

  const isValid = amount > 0 && selectedGroupId && toUserId;

  if (!isReady) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-ink text-center mb-6">
          Payment Details
        </h2>
        <div className="rounded-xl p-8 text-center backdrop-blur-sm"
             style={{
               background: 'var(--color-surface)',
               border: '1px solid var(--color-hairline)'
             }}>
          <div className="animate-pulse text-ink-muted">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink text-center mb-6">
        Payment Details
      </h2>

      {/* Payment hero. Blueberry like the rest — the arrow diagram and the
          wording carry the distinction, not a second palette. */}
      <div
        className="rounded-[14px] text-white px-5 py-5 mb-6"
        style={{
          background:
            'linear-gradient(135deg, var(--color-blueberry-600) 0%, var(--color-blueberry-700) 100%)',
          boxShadow:
            '0 2px 6px color-mix(in srgb, var(--color-blueberry-900) 22%, transparent)'
        }}
      >
        <h3 className="text-title2 font-bold flex items-center gap-2.5">
          <span className="text-white/90 shrink-0">
            <PaymentDiagram />
          </span>
          Record a payment
        </h3>
        <p className="text-subhead text-white/80 mt-1">
          Paying someone back — this reduces what you owe them
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-negative-tint border border-negative-soft rounded-xl text-sm text-negative">
          ⚠ {error}
        </div>
      )}

      {/* Amount */}
      <div className="rounded-xl p-4 space-y-3 backdrop-blur-sm"
           style={{
             background: 'var(--color-surface)',
             border: '1px solid var(--color-hairline)',
             boxShadow: '0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)'
           }}>
        <label className="text-sm font-medium text-ink">Amount</label>
        <div className="flex items-center gap-2">
          <span className="text-2xl text-ink-muted">$</span>
          <input
            type="number"
            value={amount || ""}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="flex-1 text-2xl font-bold text-ink px-3 py-2 border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            step="0.01"
            min="0"
          />
        </div>
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

      {/* Recipient */}
      <div className="rounded-xl p-4 backdrop-blur-sm"
           style={{
             background: 'var(--color-surface)',
             border: '1px solid var(--color-hairline)',
             boxShadow: '0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)'
           }}>
        <label className="text-sm font-medium text-ink block mb-2">Paying to</label>
        <select
          value={toUserId}
          onChange={(e) => setToUserId(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          <option value="">Select person...</option>
          {availableRecipients.map((r: any) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

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
          onClick={onNext}
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
