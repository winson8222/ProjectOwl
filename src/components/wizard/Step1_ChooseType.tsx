"use client";

interface Step1_ChooseTypeProps {
  txType: "expense" | "payment";
  onTypeChange: (type: "expense" | "payment") => void;
  onNext: () => void;
}

/**
 * Step 1: Choose transaction type
 * Big card selection for Add Expense vs Add Payment
 */
export default function Step1_ChooseType({ txType, onTypeChange, onNext }: Step1_ChooseTypeProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 text-center mb-6">
        What do you want to add?
      </h2>

      <div className="grid grid-cols-2 gap-4">
        {/* Expense Card */}
        <button
          onClick={() => {
            onTypeChange("expense");
            setTimeout(() => onNext(), 200);
          }}
          className={`p-6 rounded-2xl backdrop-blur-sm transition-all hover:scale-[1.02] ${
            txType === "expense" ? "ring-2 ring-[var(--primary)]" : ""
          }`}
          style={{
            background: txType === "expense"
              ? 'linear-gradient(135deg, rgba(58,133,197,0.15) 0%, rgba(58,133,197,0.08) 100%)'
              : 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
            border: '1px solid rgba(176,176,176,0.2)',
            boxShadow: txType === "expense"
              ? '0 1px 2px rgba(58,133,197,0.1), 0 2px 4px rgba(58,133,197,0.08), 0 4px 8px rgba(58,133,197,0.06)'
              : '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03), 0 4px 8px rgba(0,0,0,0.02)'
          }}
        >
          <div className="text-4xl mb-3">🧾</div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Add Expense</h3>
          <p className="text-sm text-gray-500">Split costs with friends</p>
        </button>

        {/* Payment Card */}
        <button
          onClick={() => {
            onTypeChange("payment");
            setTimeout(() => onNext(), 200);
          }}
          className={`p-6 rounded-2xl backdrop-blur-sm transition-all hover:scale-[1.02] ${
            txType === "payment" ? "ring-2 ring-[var(--primary)]" : ""
          }`}
          style={{
            background: txType === "payment"
              ? 'linear-gradient(135deg, rgba(58,133,197,0.15) 0%, rgba(58,133,197,0.08) 100%)'
              : 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
            border: '1px solid rgba(176,176,176,0.2)',
            boxShadow: txType === "payment"
              ? '0 1px 2px rgba(58,133,197,0.1), 0 2px 4px rgba(58,133,197,0.08), 0 4px 8px rgba(58,133,197,0.06)'
              : '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03), 0 4px 8px rgba(0,0,0,0.02)'
          }}
        >
          <div className="text-4xl mb-3">💸</div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Add Payment</h3>
          <p className="text-sm text-gray-500">Pay someone back</p>
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center pt-4">
        Choose the type of transaction you want to add
      </p>
    </div>
  );
}
