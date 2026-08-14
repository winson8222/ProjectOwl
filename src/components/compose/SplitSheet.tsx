"use client";

import { useMemo } from "react";
import UserAvatar, { avatarTone } from "@/components/UserAvatar";
import ItemBreakdown from "./ItemBreakdown";
import type { AssignmentResult } from "@/components/ItemAssigner";
import Portal from "@/components/Portal";
import { tapLight } from "@/lib/haptics";

export type SplitMode = "equal" | "custom";

interface SplitSheetProps {
  members: any[];
  currentUserId?: string;
  amount: number;

  participants: string[];
  onParticipantsChange: (ids: string[]) => void;

  mode: SplitMode;
  onModeChange: (mode: SplitMode) => void;

  values: Record<string, number>;
  onValuesChange: (values: Record<string, number>) => void;

  /** Present once a receipt has been assigned; drives the breakdown block. */
  assignment: AssignmentResult | null;
  /** Re-open ItemAssigner with prior work restored. */
  onEditItems?: () => void;
  /** Scan path: participants chosen, now go assign the items. */
  onAssignItems?: () => void;
  /** True when a scan is loaded but items haven't been assigned yet. */
  needsAssignment?: boolean;

  onEditAmount: (userId: string) => void;
  onClose: () => void;
}

/**
 * Who's in, and how it's divided.
 *
 * Participants start unselected — the user says who was actually there rather
 * than deselecting people who weren't.
 *
 * Switching Equally ⇄ Custom never destroys a receipt assignment: `assignment`
 * lives in the composer independently of `mode`, so a mis-tap on the segmented
 * control can't cost a pass-the-phone session. Switching back restores both the
 * per-item amounts and the breakdown block.
 */
export default function SplitSheet({
  members,
  currentUserId,
  amount,
  participants,
  onParticipantsChange,
  mode,
  onModeChange,
  values,
  onValuesChange,
  assignment,
  onEditItems,
  onAssignItems,
  needsAssignment = false,
  onEditAmount,
  onClose,
}: SplitSheetProps) {
  const allSelected =
    members.length > 0 && participants.length === members.length;

  const perHead =
    participants.length > 0 ? amount / participants.length : 0;

  const allocated = useMemo(
    () => participants.reduce((s, id) => s + (values[id] ?? 0), 0),
    [participants, values]
  );
  const remaining = Math.round((amount - allocated) * 100) / 100;
  const balanced = Math.abs(remaining) < 0.01;

  const toggle = (id: string) => {
    tapLight();
    onParticipantsChange(
      participants.includes(id)
        ? participants.filter((p) => p !== id)
        : [...participants, id]
    );
  };

  const nameFor = (m: any) => (m.id === currentUserId ? "You" : m.name);

  const shareOf = (id: string) =>
    mode === "equal" ? perHead : values[id] ?? 0;

  const canDone = participants.length > 0 && (mode === "equal" || balanced);

  return (
    <Portal>
    <div
      className="fixed inset-0 z-50 flex flex-col md:max-w-lg md:mx-auto"
      style={{ background: "var(--color-canvas)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Split"
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        className="px-4 pb-3 shrink-0"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onClose}
            className="pressable text-subhead font-medium -m-2 p-2"
            style={{ color: "var(--color-blueberry-600)", minHeight: 44 }}
          >
            Cancel
          </button>
          <h2 className="text-headline font-semibold text-ink flex-1 text-center">
            Split
          </h2>
          <button
            onClick={needsAssignment ? onAssignItems : onClose}
            disabled={!canDone}
            className="pressable text-subhead font-semibold -m-2 p-2 disabled:opacity-40"
            style={{ color: "var(--color-blueberry-600)", minHeight: 44 }}
          >
            {needsAssignment ? "Next" : "Done"}
          </button>
        </div>

        {/* Mode — hidden while choosing who's in for a scan, since the split
            is about to be decided by the item assignment itself. */}
        {!needsAssignment && (
          <div
            className="flex p-1 rounded-[12px]"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-hairline)",
            }}
            role="tablist"
          >
            {(["equal", "custom"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  tapLight();
                  onModeChange(m);
                }}
                className="flex-1 rounded-[9px] text-callout font-semibold transition-all"
                style={{
                  minHeight: 40,
                  background:
                    mode === m ? "var(--color-surface-raised)" : "transparent",
                  color:
                    mode === m
                      ? "var(--color-blueberry-600)"
                      : "var(--color-ink-muted)",
                  boxShadow:
                    mode === m
                      ? "0 1px 3px color-mix(in srgb, var(--color-blueberry-900) 12%, transparent)"
                      : "none",
                }}
              >
                {m === "equal" ? "Split equally" : "Custom amounts"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {assignment && mode === "custom" && !needsAssignment && (
          <ItemBreakdown
            assignment={assignment}
            members={members}
            currentUserId={currentUserId}
            onEdit={onEditItems}
          />
        )}

        <div className="flex items-center justify-between mb-3">
          <p className="text-footnote font-semibold text-ink-muted uppercase tracking-wider">
            {needsAssignment ? "Who was there" : "Split between"}
          </p>
          <button
            onClick={() => {
              tapLight();
              onParticipantsChange(allSelected ? [] : members.map((m) => m.id));
            }}
            className="pressable text-subhead font-semibold"
            style={{ color: "var(--color-blueberry-600)", minHeight: 44 }}
          >
            {allSelected ? "Clear all" : "Select all"}
          </button>
        </div>

        <div className="space-y-2">
          {members.map((m: any) => {
            const on = participants.includes(m.id);
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 px-3.5 rounded-[14px] transition-colors"
                style={{
                  minHeight: 60,
                  background: on
                    ? "var(--color-blueberry-100)"
                    : "var(--color-surface)",
                  border: `1px solid ${
                    on ? "var(--color-blueberry-600)" : "var(--color-hairline)"
                  }`,
                }}
              >
                <button
                  onClick={() => toggle(m.id)}
                  aria-pressed={on}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  style={{ minHeight: 56 }}
                >
                  <span
                    className="shrink-0 rounded-[7px] flex items-center justify-center"
                    style={{
                      width: 24,
                      height: 24,
                      background: on
                        ? "var(--color-blueberry-600)"
                        : "transparent",
                      border: on
                        ? "none"
                        : "2px solid var(--color-blueberry-300)",
                    }}
                  >
                    {on && (
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M5 12.5l5 5 9-10" />
                      </svg>
                    )}
                  </span>
                  <UserAvatar name={m.name} size="md" />
                  <span className="flex-1 min-w-0 text-callout font-medium text-ink truncate">
                    {nameFor(m)}
                  </span>
                </button>

                {/* Amount: tappable in custom mode, read-only otherwise. */}
                {!needsAssignment &&
                  on &&
                  (mode === "custom" ? (
                    <button
                      onClick={() => {
                        tapLight();
                        onEditAmount(m.id);
                      }}
                      aria-label={`Set ${m.name}'s share`}
                      className="pressable shrink-0 px-3 rounded-[10px] text-callout font-semibold text-ink tabular"
                      style={{
                        minHeight: 44,
                        minWidth: 84,
                        background: "var(--color-surface-raised)",
                        border: "1px solid var(--color-hairline)",
                      }}
                    >
                      ${shareOf(m.id).toFixed(2)}
                    </button>
                  ) : (
                    <span className="shrink-0 text-callout font-semibold text-ink tabular pr-1">
                      ${shareOf(m.id).toFixed(2)}
                    </span>
                  ))}
              </div>
            );
          })}
        </div>

        {/* Split as a shape — proportional in custom mode. */}
        {participants.length > 0 && amount > 0 && !needsAssignment && (
          <div className="mt-4">
            <div
              className="flex h-2.5 rounded-full overflow-hidden gap-[2px]"
              aria-hidden
            >
              {participants.map((id) => {
                const m = members.find((x: any) => x.id === id);
                const weight =
                  mode === "custom" && allocated > 0
                    ? (values[id] ?? 0) / allocated
                    : 1 / participants.length;
                return (
                  <span
                    key={id}
                    style={{
                      flexGrow: Math.max(0.0001, weight),
                      background: m ? avatarTone(m.name) : "transparent",
                      transition: "flex-grow 220ms ease-out",
                    }}
                  />
                );
              })}
            </div>

            {mode === "custom" && (
              <p
                className="text-footnote font-medium mt-2"
                style={{
                  color: balanced
                    ? "var(--color-positive)"
                    : remaining < 0
                    ? "var(--color-negative)"
                    : "var(--color-warning)",
                }}
              >
                {balanced
                  ? `All $${amount.toFixed(2)} accounted for`
                  : remaining > 0
                  ? `$${remaining.toFixed(2)} left to assign`
                  : `$${Math.abs(remaining).toFixed(2)} over the total`}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
    </Portal>
  );
}
