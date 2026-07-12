"use client";

interface BalanceCardProps {
  netBalance: number;
  totalOwed: number;
  totalOwe: number;
}

/**
 * Balance summary card: headline net balance + owe/owed breakdown.
 */
export default function BalanceCard({ netBalance, totalOwed, totalOwe }: BalanceCardProps) {
  const isPositive = netBalance >= 0;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 text-center">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
        Net Balance
      </p>
      <p className={`text-3xl font-bold ${isPositive ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
        {isPositive ? "+" : ""}${Math.abs(netBalance).toFixed(2)}
      </p>
      <div className="flex justify-center gap-6 mt-3">
        <div className="text-center">
          <p className="text-lg font-semibold text-[var(--success)]">+${totalOwed.toFixed(2)}</p>
          <p className="text-xs text-gray-400">owed to you</p>
        </div>
        <div className="w-px bg-[var(--border)]" />
        <div className="text-center">
          <p className="text-lg font-semibold text-[var(--danger)]">-${totalOwe.toFixed(2)}</p>
          <p className="text-xs text-gray-400">you owe</p>
        </div>
      </div>
    </div>
  );
}
