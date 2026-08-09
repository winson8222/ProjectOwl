"use client";

import UserAvatar from "@/components/UserAvatar";
import { tapMedium } from "@/lib/haptics";

interface Step5_ReviewProps {
  txType: "expense" | "payment";
  amount: number;
  date: string;
  title: string;
  paidBy: string;
  toUserId: string;
  selectedGroupId: string;
  selectedParticipants: string[];
  splitMode: "even" | "custom";
  splitValues: Record<string, number>;
  onSave: () => void;
  onBack: () => void;
  saving: boolean;
  user: any;
  groups: any[];
  users: any[];
  inputMethod: "scan" | "manual";
  assignmentResults: any;
}

/**
 * Step 5: review and save.
 *
 * The old version summarised the split as "Participants: 4 people", which is
 * the one fact on the screen you can't actually check. This shows every
 * person and the exact amount they'll owe — a review screen has to show what
 * you're about to commit, or it's just a delay before the save button.
 *
 * Shares come from whichever path produced them: item assignment totals for
 * scans, splitValues for manual even/custom.
 */
export default function Step5_Review({
  txType,
  amount,
  date,
  title,
  paidBy,
  toUserId,
  selectedGroupId,
  selectedParticipants,
  splitMode,
  splitValues,
  onSave,
  onBack,
  saving,
  user,
  groups,
  users,
  inputMethod,
  assignmentResults,
}: Step5_ReviewProps) {
  const group = groups.find((g: any) => g.id === selectedGroupId);
  const payer = users.find((u: any) => u.id === paidBy);
  const recipient = users.find((u: any) => u.id === toUserId);

  const shares: Record<string, number> =
    inputMethod === "scan" && assignmentResults?.totals
      ? assignmentResults.totals
      : splitValues;

  const nameFor = (id: string) => {
    const u = users.find((x: any) => x.id === id);
    return id === user?.id ? "You" : u?.name ?? "Someone";
  };
  const rawName = (id: string) =>
    users.find((x: any) => x.id === id)?.name ?? "?";

  const dateLabel = new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const methodLabel =
    inputMethod === "scan" && assignmentResults
      ? "Split by item"
      : splitMode === "even"
      ? "Split evenly"
      : "Custom amounts";

  return (
    <div>
      <h2 className="text-title2 font-bold text-ink mb-6">
        {txType === "payment" ? "Confirm this payment" : "Does this look right?"}
      </h2>

      {/* ── The headline: what's being committed ─────────────────── */}
      <div
        className="rounded-t-[14px] px-5 pt-6 pb-5 text-center"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-hairline)",
          borderBottom: "none",
        }}
      >
        <p
          className="text-display font-bold tabular"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--color-blueberry-600)",
          }}
        >
          ${amount.toFixed(2)}
        </p>
        {txType === "expense" && title && (
          <p className="text-headline font-semibold text-ink mt-1">{title}</p>
        )}
        <p className="text-subhead text-ink-muted mt-1">
          {dateLabel}
          {group ? ` · ${group.name}` : ""}
        </p>
      </div>

      <div className="receipt-edge-bottom" />

      {/* ── Who it lands on ──────────────────────────────────────── */}
      <div className="mt-5">
        {txType === "payment" ? (
          <div className="flex items-center justify-center gap-4 py-2">
            <div className="flex flex-col items-center gap-1.5">
              <UserAvatar name={rawName(paidBy) || user?.name} size="lg" />
              <span className="text-footnote text-ink-muted">
                {nameFor(paidBy)}
              </span>
            </div>
            <svg
              width="28"
              height="16"
              viewBox="0 0 28 16"
              fill="none"
              stroke="var(--color-blueberry-600)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M2 8h22M20 4l4 4-4 4" />
            </svg>
            <div className="flex flex-col items-center gap-1.5">
              <UserAvatar name={rawName(toUserId)} size="lg" />
              <span className="text-footnote text-ink-muted">
                {nameFor(toUserId)}
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-footnote font-semibold text-ink-muted uppercase tracking-wider">
                {nameFor(paidBy)} paid · {methodLabel}
              </p>
            </div>

            <div className="space-y-2">
              {selectedParticipants.map((id) => (
                <div
                  key={id}
                  className="flex items-center gap-3 px-3.5 rounded-[14px]"
                  style={{
                    minHeight: 56,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-hairline)",
                  }}
                >
                  <UserAvatar name={rawName(id)} size="md" />
                  <span className="text-callout font-medium text-ink truncate">
                    {nameFor(id)}
                  </span>
                  <span className="leader" aria-hidden />
                  <span className="text-callout font-semibold text-ink tabular shrink-0">
                    ${(shares[id] ?? 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Save ─────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-7">
        <button
          onClick={onBack}
          disabled={saving}
          className="pressable px-5 rounded-[12px] text-body font-medium text-ink disabled:opacity-40"
          style={{
            minHeight: 50,
            background: "var(--color-surface)",
            border: "1px solid var(--color-hairline)",
          }}
        >
          Back
        </button>
        <button
          onClick={() => {
            tapMedium();
            onSave();
          }}
          disabled={saving}
          className="pressable flex-1 rounded-[12px] text-body font-semibold text-white disabled:opacity-50"
          style={{ minHeight: 50, background: "var(--color-blueberry-600)" }}
        >
          {saving
            ? "Saving…"
            : txType === "payment"
            ? "Record payment"
            : "Save expense"}
        </button>
      </div>
    </div>
  );
}
