"use client";

import UserAvatar from "@/components/UserAvatar";
import { tapMedium } from "@/lib/haptics";

interface Step5_ReviewProps {
  amount: number;
  date: string;
  title: string;
  paidBy: string;
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
}

/**
 * Step 5: review and save the expense.
 *
 * The old version summarised the split as "Participants: 4 people", which is
 * the one fact on the screen you can't actually check. This shows every
 * person and the exact amount they'll owe — a review screen has to show what
 * you're about to commit, or it's just a delay before the save button.
 *
 * splitValues is the live source of truth for both flows by this point —
 * for scan it was seeded from the item allocation on the previous step, then
 * left editable, same as manual custom amounts.
 */
export default function Step5_Review({
  amount,
  date,
  title,
  paidBy,
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
}: Step5_ReviewProps) {
  const group = groups.find((g: any) => g.id === selectedGroupId);
  const shares: Record<string, number> = splitValues;

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

  const methodLabel = splitMode === "even" ? "Split evenly" : "Custom amounts";

  return (
    <div>
      <h2 className="text-title2 font-bold text-ink mb-6">Does this look right?</h2>

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
        {title && (
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
          {saving ? "Saving…" : "Save expense"}
        </button>
      </div>
    </div>
  );
}
