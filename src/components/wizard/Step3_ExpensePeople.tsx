"use client";

import UserPicker from "@/components/UserPicker";

interface Step3_ExpensePeopleProps {
  paidBy: string;
  setPaidBy: (id: string) => void;
  selectedParticipants: string[];
  setSelectedParticipants: (ids: string[]) => void;
  user: any;
  users: any[];
  selectedGroupId: string;
  onNext: () => void;
  onBack: () => void;
}

/**
 * Step 3b (Expense + Manual): Who paid and participants
 */
export default function Step3_ExpensePeople({
  paidBy,
  setPaidBy,
  selectedParticipants,
  setSelectedParticipants,
  user,
  users,
  selectedGroupId,
  onNext,
  onBack
}: Step3_ExpensePeopleProps) {
  const isValid = paidBy && selectedParticipants.length > 0;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 text-center mb-6">
        Who's involved?
      </h2>

      {/* Who Paid */}
      <div className="rounded-xl p-4 backdrop-blur-sm"
           style={{
             background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
             border: '1px solid rgba(176,176,176,0.2)',
             boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)'
           }}>
        <label className="text-sm font-medium text-gray-700 block mb-2">Who paid?</label>
        <UserPicker
          selectedUserIds={[paidBy]}
          onChange={(ids) => setPaidBy(ids[0] || "")}
          users={users}
          label=""
        />
      </div>

      {/* Participants */}
      <div className="rounded-xl p-4 backdrop-blur-sm"
           style={{
             background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(248,250,252,0.25) 100%)',
             border: '1px solid rgba(176,176,176,0.2)',
             boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)'
           }}>
        <label className="text-sm font-medium text-gray-700 block mb-2">
          Split with whom?
        </label>
        <UserPicker
          selectedUserIds={selectedParticipants}
          onChange={setSelectedParticipants}
          users={users}
          label=""
        />
      </div>

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
          disabled={!isValid}
          className="flex-1 px-4 py-3 text-sm font-semibold text-white rounded-xl backdrop-blur-sm transition-all disabled:opacity-50"
          style={{
            background: isValid
              ? 'linear-gradient(135deg, rgba(58,133,197,0.9) 0%, rgba(42,107,165,0.85) 100%)'
              : 'linear-gradient(135deg, rgba(176,176,176,0.3) 0%, rgba(176,176,176,0.2) 100%)',
            border: '1px solid rgba(58,133,197,0.4)',
            boxShadow: isValid
              ? '0 2px 4px rgba(58,133,197,0.2), 0 4px 8px rgba(58,133,197,0.15)'
              : 'none'
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
