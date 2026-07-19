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
  const date = new Date(transactionDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  if (type === "payment") {
    const youReceived = recipientUserId === currentUserId;
    return (
      <Link
        href={`/transactions/${id}`}
        className="flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:bg-gray-50 transition-colors"
      >
        <span className="text-lg shrink-0">💸</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {youPaid ? "You" : paidByUserName} paid{" "}
            {youReceived ? "you" : recipientName ?? "someone"}
          </p>
          <p className="text-xs text-gray-400">Payment · {date}</p>
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
      className="flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:bg-gray-50 transition-colors"
    >
      <UserAvatar name={paidByUserName} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
        <p className="text-xs text-gray-400">
          {youPaid ? "You paid" : `${paidByUserName} paid`} · ${totalAmount.toFixed(2)} · {date}
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
