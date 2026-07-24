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
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 text-center mb-6">
        How should we split this?
      </h2>

      <SplitInput
        participants={participants}
        totalAmount={totalAmount}
        values={splitValues}
        onChange={onChange}
        mode={splitMode}
        onModeChange={onModeChange}
      />

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-3 text-sm font-medium text-gray-600 rounded-xl backdrop-blur-sm transition-all"
          style={{
            border: '1px solid rgba(176,176,176,0.2)',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(248,250,252,0.2) 100%)'
          }}
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 px-4 py-3 text-sm font-semibold text-white rounded-xl backdrop-blur-sm transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(58,133,197,0.9) 0%, rgba(42,107,165,0.85) 100%)',
            border: '1px solid rgba(58,133,197,0.4)',
            boxShadow: '0 2px 4px rgba(58,133,197,0.2), 0 4px 8px rgba(58,133,197,0.15)'
          }}
        >
          Review →
        </button>
      </div>
    </div>
  );
}
