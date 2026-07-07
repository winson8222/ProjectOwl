"use client";

import Link from "next/link";

/**
 * New transaction type picker — two cards: Scan receipt or Manual entry.
 */
export default function NewTransactionPage() {
  return (
    <main className="min-h-dvh px-4 pt-8 pb-8 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-2">New Transaction</h1>
      <p className="text-sm text-gray-500 mb-6">How do you want to start?</p>

      <div className="space-y-4">
        {/* Scan receipt */}
        <Link
          href="/transactions/new/scan"
          className="block p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl hover:border-[var(--primary)] hover:shadow-sm transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="text-3xl">📸</div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">
                Scan a receipt
              </h2>
              <p className="text-sm text-gray-500">
                Take a photo and we&apos;ll extract items, prices, and totals
              </p>
            </div>
          </div>
        </Link>

        {/* Manual entry */}
        <Link
          href="/transactions/new/manual"
          className="block p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl hover:border-[var(--primary)] hover:shadow-sm transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="text-3xl">✏️</div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">
                Manual entry
              </h2>
              <p className="text-sm text-gray-500">
                Type a description, amount, and split with friends
              </p>
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}
