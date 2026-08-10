"use client";

import SplitInput from "@/components/SplitInput";
import UserAvatar from "@/components/UserAvatar";
import type { AssignmentResult } from "@/components/ItemAssigner";

interface Step4_SplitMethodProps {
  splitMode: "even" | "custom";
  onModeChange: (mode: "even" | "custom") => void;
  splitValues: Record<string, number>;
  onChange: (values: Record<string, number>) => void;
  participants: any[];
  totalAmount: number;
  onNext: () => void;
  onBack: () => void;

  // Scan-flow only: shows the item allocation above the split editor and a
  // way to re-open it / sync the total to it. Undefined for the manual flow.
  assignmentResults?: AssignmentResult | null;
  onEditAllocation?: () => void;
  allocationTotal?: number;
  onUseAllocationTotal?: () => void;
}

/**
 * Step 4 (Expense): Choose split method.
 *
 * Shared between the manual and scan flows. For scan, `assignmentResults` is
 * passed so the item allocation shows above the split editor — the split
 * itself is always editable from here regardless of how it was seeded.
 */
export default function Step4_SplitMethod({
  splitMode,
  onModeChange,
  splitValues,
  onChange,
  participants,
  totalAmount,
  onNext,
  onBack,
  assignmentResults,
  onEditAllocation,
  allocationTotal,
  onUseAllocationTotal,
}: Step4_SplitMethodProps) {
  const nameFor = (userId: string) =>
    participants.find((p) => p.id === userId)?.name || "?";

  return (
    <div>
      <h2 className="text-title2 font-bold text-ink mb-6">How should we split it?</h2>

      {assignmentResults && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-footnote font-semibold text-ink-muted uppercase tracking-wider">
              Item allocation
            </p>
            {onEditAllocation && (
              <button
                onClick={onEditAllocation}
                className="text-footnote font-semibold text-blueberry-600"
              >
                Edit allocation
              </button>
            )}
          </div>

          <div className="space-y-2 mb-3">
            {assignmentResults.items.map((item, i) => {
              const assignees = assignmentResults.assignmentsByItem[i] ?? [];
              const uniqueUserIds = Array.from(new Set(assignees.map((a) => a.userId)));
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3.5 rounded-card"
                  style={{
                    minHeight: 52,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-hairline)",
                  }}
                >
                  <span className="flex-1 min-w-0 text-callout text-ink truncate font-mono">
                    {item.nm}
                    {(item.cnt ?? 1) > 1 && (
                      <span className="text-footnote text-ink-muted ml-1">×{item.cnt}</span>
                    )}
                  </span>
                  <span className="flex -space-x-1.5 shrink-0">
                    {uniqueUserIds.length === 0 ? (
                      <span className="text-footnote text-ink-muted">unassigned</span>
                    ) : (
                      uniqueUserIds.map((uid) => (
                        <UserAvatar key={uid} name={nameFor(uid)} size="sm" />
                      ))
                    )}
                  </span>
                  <span className="text-callout font-semibold text-ink tabular shrink-0">
                    ${item.price.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>

          {onUseAllocationTotal && allocationTotal != null && (
            <button
              onClick={onUseAllocationTotal}
              disabled={Math.abs(allocationTotal - totalAmount) < 0.01}
              className="pressable w-full text-footnote font-semibold text-blueberry-600 disabled:opacity-40 disabled:text-ink-muted"
              style={{ minHeight: 36 }}
            >
              {Math.abs(allocationTotal - totalAmount) < 0.01
                ? `Total matches allocation ($${allocationTotal.toFixed(2)})`
                : `Use allocation total ($${allocationTotal.toFixed(2)})`}
            </button>
          )}
        </div>
      )}

      <SplitInput
        participants={participants}
        totalAmount={totalAmount}
        values={splitValues}
        onChange={onChange}
        mode={splitMode}
        onModeChange={onModeChange}
      />

      {/* Navigation */}
      <div className="flex gap-3 pt-7">
        <button
          onClick={onBack}
          className="pressable px-5 rounded-[12px] text-body font-medium text-ink"
          style={{
            minHeight: 50,
            background: "var(--color-surface)",
            border: "1px solid var(--color-hairline)",
          }}
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="pressable flex-1 rounded-[12px] text-body font-semibold text-white"
          style={{ minHeight: 50, background: "var(--color-blueberry-600)" }}
        >
          Review
        </button>
      </div>
    </div>
  );
}
