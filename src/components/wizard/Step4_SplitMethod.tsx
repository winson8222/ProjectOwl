"use client";

import SplitInput from "@/components/SplitInput";

interface Step4_SplitMethodProps {
  splitMode: "even" | "custom";
  onModeChange: (mode: "even" | "custom") => void;
  splitValues: Record<string, number>;
  onChange: (values: Record<string, number>) => void;
  participants: any[];
  totalAmount: number;
  onNext: () => void;
  onBack: () => void;
}

/**
 * Step 4 (Expense): Choose split method
 */
export default function Step4_SplitMethod({
  splitMode,
  onModeChange,
  splitValues,
  onChange,
  participants,
  totalAmount,
  onNext,
  onBack
}: Step4_SplitMethodProps) {
  return (
    <div>
      <h2 className="text-title2 font-bold text-ink mb-6">How should we split it?</h2>

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
