"use client";

import Link from "next/link";
import UserAvatar from "./UserAvatar";

interface TransactionCardProps {
  id: string;
  title: string;
  totalAmount: number;
  userShare: number;
  paidByUserName: string;
  paidByUserId: string;
  currentUserId: string;
  transactionDate: string;
  /** "expense" (default) or "payment" (direct user→user payment). */
  type?: string;
  /** Payment recipient's name (payments only). */
  recipientName?: string;
  recipientUserId?: string;
}

/**
 * Summary row for a single transaction in list views.
 */
export default function TransactionCard({
  id,
  title,
  totalAmount,
  userShare,
  paidByUserName,
  paidByUserId,
  currentUserId,
  transactionDate,
  type,
  recipientName,
  recipientUserId,
}: TransactionCardProps) {
  const youPaid = paidByUserId === currentUserId;
  const date = new Date(transactionDate);
  const day = date.getDate();
  const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();

  if (type === "payment") {
    const youReceived = recipientUserId === currentUserId;
    return (
      <Link
        href={`/transactions/${id}`}
        className="flex items-center gap-3 px-4 py-3 rounded-xl backdrop-blur-sm transition-all hover:scale-[1.02]"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(248,250,252,0.15) 100%)',
          border: '1px solid rgba(176,176,176,0.2)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03), 0 4px 8px rgba(0,0,0,0.02)'
        }}
      >
        {/* Calendar-style date */}
        <div className="flex flex-col items-center justify-center rounded-lg px-2 py-1 shrink-0" style={{
          background: 'linear-gradient(135deg, rgba(58,133,197,0.1) 0%, rgba(58,133,197,0.05) 100%)',
          border: '1px solid rgba(58,133,197,0.2)'
        }}>
          <span className="text-[10px] font-semibold text-[var(--primary)] leading-none">{month}</span>
          <span className="text-sm font-bold text-gray-900 leading-tight">{day}</span>
        </div>
        <span className="text-lg shrink-0">💸</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {youPaid ? "You" : paidByUserName} paid{" "}
            {youReceived ? "you" : recipientName ?? "someone"}
          </p>
          <p className="text-xs text-gray-400">Payment</p>
        </div>
        <p className={`text-sm font-semibold ${
          youReceived ? "text-[var(--success)]" : youPaid ? "text-[var(--danger)]" : "text-gray-500"
        }`}>
          ${totalAmount.toFixed(2)}
        </p>
      </Link>
    );
  }

  return (
    <Link
      href={`/transactions/${id}`}
      className="flex items-center gap-3 px-4 py-3 rounded-xl backdrop-blur-sm transition-all hover:scale-[1.02]"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(248,250,252,0.15) 100%)',
        border: '1px solid rgba(176,176,176,0.2)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03), 0 4px 8px rgba(0,0,0,0.02)'
      }}
    >
      {/* Calendar-style date */}
      <div className="flex flex-col items-center justify-center rounded-lg px-2 py-1 shrink-0" style={{
        background: 'linear-gradient(135deg, rgba(58,133,197,0.1) 0%, rgba(58,133,197,0.05) 100%)',
        border: '1px solid rgba(58,133,197,0.2)'
      }}>
        <span className="text-[10px] font-semibold text-[var(--primary)] leading-none">{month}</span>
        <span className="text-sm font-bold text-gray-900 leading-tight">{day}</span>
      </div>
      <UserAvatar name={paidByUserName} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
        <p className="text-xs text-gray-400">
          {youPaid ? "You paid" : `${paidByUserName} paid`} · ${totalAmount.toFixed(2)}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${
          youPaid ? "text-[var(--success)]" : "text-[var(--danger)]"
        }`}>
          {youPaid ? "+" : ""}${userShare.toFixed(2)}
        </p>
        <p className="text-xs text-gray-400">
          {youPaid ? "your payment" : "your share"}
        </p>
      </div>
    </Link>
  );
}
