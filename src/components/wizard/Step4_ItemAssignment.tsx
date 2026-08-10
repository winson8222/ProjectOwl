"use client";

import ItemAssigner from "@/components/ItemAssigner";

interface Step4_ItemAssignmentProps {
  scanItems: any[];
  selectedParticipants: string[];
  users: any[];
  onAssign: (results: any) => void;
  onBack: () => void;
  /** Restore prior per-unit assignments when re-opening to edit. */
  initialUnitState?: Record<string, string[]>;
}

/**
 * Step 4 (Expense + Scan): Item assignment using ItemAssigner
 */
export default function Step4_ItemAssignment({
  scanItems,
  selectedParticipants,
  users,
  onAssign,
  onBack,
  initialUnitState
}: Step4_ItemAssignmentProps) {
  const participants = selectedParticipants.map(id => {
    const user = users.find((u: any) => u.id === id);
    return { id, name: user?.name || "" };
  }).filter(p => p.name);

  const items = scanItems.map((item, idx) => ({
    id: idx,
    nm: item.nm || "Item",
    price: item.price || 0,
    cnt: item.cnt || 1
  }));

  const handleConfirm = (result: any) => {
    onAssign(result);
  };

  const handleCancel = () => {
    onBack();
  };

  if (participants.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-surface-raised flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-ink-muted">No participants selected</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 text-sm font-medium text-ink-muted border border-hairline rounded-lg"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-surface-raised flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-ink-muted">No items found in receipt</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 text-sm font-medium text-ink-muted border border-hairline rounded-lg"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <ItemAssigner
      items={items}
      participants={participants}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      initialUnitState={initialUnitState}
    />
  );
}
