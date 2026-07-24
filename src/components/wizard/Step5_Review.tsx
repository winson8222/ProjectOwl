"use client";

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
 * Step 5: Review and save
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
  assignmentResults
}: Step5_ReviewProps) {
  const group = groups.find((g: any) => g.id === selectedGroupId);
  const payer = users.find((u: any) => u.id === paidBy);
  const recipient = users.find((u: any) => u.id === toUserId);
  const participantList = selectedParticipants.map((id) => {
    const u = users.find((user: any) => user.id === id);
    return { id, name: u?.name || "" };
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 text-center mb-6">
        Review & Save
      </h2>

      {/* Summary Card */}
      <div
        className="rounded-2xl p-5 backdrop-blur-sm"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(248,250,252,0.3) 100%)',
          border: '1px solid rgba(176,176,176,0.2)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03), 0 4px 8px rgba(0,0,0,0.02)'
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">{txType === "payment" ? "💸" : "🧾"}</span>
          <h3 className="text-lg font-bold text-gray-900">
            {txType === "payment" ? "Payment" : "Expense"}
          </h3>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Amount</span>
            <span className="text-lg font-bold text-gray-900">${amount.toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Date</span>
            <span className="text-sm text-gray-900">
              {new Date(date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              })}
            </span>
          </div>

          {group && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Group</span>
              <span className="text-sm text-gray-900">{group.name}</span>
            </div>
          )}

          {txType === "expense" && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Paid by</span>
                <span className="text-sm text-gray-900">
                  {paidBy === user?.id ? "You" : payer?.name || "Someone"}
                </span>
              </div>

              {inputMethod === "scan" && assignmentResults ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Split method</span>
                    <span className="text-sm text-gray-900">Item assignment</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Split method</span>
                    <span className="text-sm text-gray-900 capitalize">{splitMode} split</span>
                  </div>
                </>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Participants</span>
                <span className="text-sm text-gray-900">{selectedParticipants.length} people</span>
              </div>
            </>
          )}

          {txType === "payment" && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Paying to</span>
              <span className="text-sm text-gray-900">
                {toUserId === user?.id ? "You" : recipient?.name || "Someone"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Ready to save indicator */}
      <div
        className="rounded-xl p-4 text-center backdrop-blur-sm"
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(20,184,166,0.05) 100%)',
          border: '1px solid rgba(16,185,129,0.2)'
        }}
      >
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg">✓</span>
          <span className="text-sm font-semibold text-emerald-700">
            Ready to save
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          disabled={saving}
          className="flex-1 px-4 py-3 text-sm font-medium text-gray-600 rounded-xl backdrop-blur-sm transition-all disabled:opacity-50"
          style={{
            border: '1px solid rgba(176,176,176,0.2)',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(248,250,252,0.2) 100%)'
          }}
        >
          ← Back
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 px-4 py-3 text-sm font-semibold text-white rounded-xl backdrop-blur-sm transition-all disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, rgba(58,133,197,0.9) 0%, rgba(42,107,165,0.85) 100%)',
            border: '1px solid rgba(58,133,197,0.4)',
            boxShadow: '0 2px 4px rgba(58,133,197,0.2), 0 4px 8px rgba(58,133,197,0.15)'
          }}
        >
          {saving ? "Saving..." : "Save Transaction"}
        </button>
      </div>
    </div>
  );
}
