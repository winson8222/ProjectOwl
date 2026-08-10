"use client";

import ItemAssigner from "@/components/ItemAssigner";
import type { Adjustments } from "@/lib/adjustments";

interface Step4_ItemAssignmentProps {
  /** Items as scanned — the "reset to scan" baseline. */
  scanItems: any[];
  selectedParticipants: string[];
  users: any[];
  onAssign: (results: any) => void;
  /** Step back to the people picker, keeping the draft. */
  onBack: () => void;
  /** Abandon the whole expense. */
  onCancel: () => void;
  /** Restore previously edited item prices when re-opening to edit. */
  initialEditedItems?: { nm: string; price: number; cnt?: number }[];
  /** Restore prior per-unit assignments when re-opening to edit. */
  initialUnitState?: Record<string, string[]>;
  /** Tax/discount and total read off the receipt — the "reset to scan" state. */
  scannedAdjustments?: Adjustments;
  scannedTotal?: number;
  /** Restore previously edited tax/discount lines and total when re-opening. */
  initialAdjustments?: Adjustments;
  initialTotal?: number;
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
  onCancel,
  initialEditedItems,
  initialUnitState,
  scannedAdjustments,
  scannedTotal,
  initialAdjustments,
  initialTotal
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
      onBack={onBack}
      onCancel={onCancel}
      initialEditedItems={initialEditedItems}
      initialUnitState={initialUnitState}
      scannedAdjustments={scannedAdjustments}
      scannedTotal={scannedTotal}
      initialAdjustments={initialAdjustments}
      initialTotal={initialTotal}
    />
  );
}
