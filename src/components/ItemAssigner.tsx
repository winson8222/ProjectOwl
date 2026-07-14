"use client";

import { useState, useMemo } from "react";
import UserAvatar from "@/components/UserAvatar";
import { computeAllocation, unitKey, type UnitState } from "@/lib/allocation";

interface ScannedItem {
  id: number; // temporary index
  nm: string;
  price: number;
  cnt?: number;
}

interface Participant {
  id: string;
  name: string;
}

export interface AssignmentResult {
  /** Edited items (prices may have been changed here) */
  items: { nm: string; price: number; cnt?: number }[];
  /** Per-item, per-user resolved share amounts — index matches items[].
   *  Shares can be uneven when a multi-quantity item's units go to
   *  different people. */
  assignmentsByItem: { userId: string; shareAmount: number }[][];
  /** Per-participant calculated totals */
  totals: Record<string, number>;
  /** Raw per-unit assignment state ("<itemIdx>:<unitIdx>" → userIds),
   *  passed back in on re-edit so prior work is preserved exactly. */
  unitState: Record<string, string[]>;
}

interface ItemAssignerProps {
  items: ScannedItem[];
  participants: Participant[];
  onConfirm: (result: AssignmentResult) => void;
  onCancel: () => void;
  /** Restore prior per-unit assignments when re-opening to edit. */
  initialUnitState?: Record<string, string[]>;
}

/**
 * "Pass the phone" item assignment screen.
 *
 * Full-screen flow: an active-user selector sits at the top. Each person, in
 * turn, taps their name to become "active", then taps the items they shared.
 *
 * Multi-quantity items (cnt > 1) expand into a main row + one sub-row per unit:
 *  - Tapping the MAIN row assigns/removes the active user on ALL units.
 *  - Tapping a SUB row toggles the active user on just that one unit.
 *
 * Each unit's price (itemPrice / cnt) splits evenly among whoever is on it,
 * so shares can be uneven across people. All units start unassigned; item
 * prices stay editable inline.
 */
export default function ItemAssigner({
  items: initialItems,
  participants,
  onConfirm,
  onCancel,
  initialUnitState,
}: ItemAssignerProps) {
  // Editable items (prices stay editable at this stage)
  const [items, setItems] = useState(() =>
    initialItems.map((it) => ({ nm: it.nm, price: it.price, cnt: it.cnt ?? 1 }))
  );

  // Per-unit assignments. Restored from a prior edit if provided,
  // otherwise all units start EMPTY (unassigned).
  const [unitAssignments, setUnitAssignments] = useState<Map<string, Set<string>>>(
    () => {
      const m = new Map<string, Set<string>>();
      if (initialUnitState) {
        for (const [key, uids] of Object.entries(initialUnitState)) {
          m.set(key, new Set(uids));
        }
      }
      return m;
    }
  );

  const [activeUser, setActiveUser] = useState<string>(participants[0]?.id ?? "");

  // Which multi-qty items are expanded to show their unit sub-rows
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const getUnitSet = (key: string) => unitAssignments.get(key) ?? new Set<string>();

  const toggleUnit = (itemIndex: number, unitIndex: number) => {
    if (!activeUser) return;
    setUnitAssignments((prev) => {
      const next = new Map(prev);
      const key = unitKey(itemIndex, unitIndex);
      const current = new Set(next.get(key) ?? []);
      if (current.has(activeUser)) current.delete(activeUser);
      else current.add(activeUser);
      next.set(key, current);
      return next;
    });
  };

  /** Assign/remove the active user across ALL units of an item.
   *  If they're on every unit → remove from all; otherwise → add to all. */
  const toggleWholeItem = (itemIndex: number, cnt: number) => {
    if (!activeUser) return;
    const allAssigned = Array.from({ length: cnt }).every((_, u) =>
      getUnitSet(unitKey(itemIndex, u)).has(activeUser)
    );
    setUnitAssignments((prev) => {
      const next = new Map(prev);
      for (let u = 0; u < cnt; u++) {
        const key = unitKey(itemIndex, u);
        const current = new Set(next.get(key) ?? []);
        if (allAssigned) current.delete(activeUser);
        else current.add(activeUser);
        next.set(key, current);
      }
      return next;
    });
  };

  const updateItemPrice = (itemIndex: number, price: number) => {
    setItems((prev) => {
      const next = [...prev];
      next[itemIndex] = { ...next[itemIndex], price };
      return next;
    });
  };

  const toggleExpand = (itemIndex: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(itemIndex)) next.delete(itemIndex);
      else next.add(itemIndex);
      return next;
    });
  };

  // Snapshot the Map as a plain UnitState object (the shared allocation format).
  const unitState = useMemo<UnitState>(() => {
    const obj: UnitState = {};
    for (const [key, set] of unitAssignments) {
      if (set.size > 0) obj[key] = Array.from(set);
    }
    return obj;
  }, [unitAssignments]);

  // Resolve per-item, per-user shares via the shared allocation function,
  // so the UI shows exactly what the allocation test suite verifies.
  const { assignmentsByItem, totals: computedTotals, unassignedUnits } = useMemo(
    () => computeAllocation(items, unitState),
    [items, unitState]
  );

  // Ensure every participant appears in the totals (even at $0) for display.
  const participantTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const p of participants) t[p.id] = computedTotals[p.id] ?? 0;
    return t;
  }, [participants, computedTotals]);

  const totalBill = items.reduce((s, i) => s + i.price, 0);
  const totalAssigned = Object.values(computedTotals).reduce((s, v) => s + v, 0);
  const unassignedCount = unassignedUnits;

  const handleConfirm = () => {
    onConfirm({ items, assignmentsByItem, totals: participantTotals, unitState });
  };

  // Render avatars for a set of assigned user ids
  const renderAvatars = (assigned: Set<string>) =>
    Array.from(assigned).map((uid) => {
      const p = participants.find((pp) => pp.id === uid);
      if (!p) return null;
      return <UserAvatar key={uid} name={p.name} size="sm" />;
    });

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overscroll-none">
      {/* ── Header (safe-area aware) ───────────────────────────── */}
      <div
        className="px-4 pb-3 border-b border-[var(--border)] shrink-0"
        style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900">Assign Items</h2>
          <button
            onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-700 -m-2 p-2"
          >
            Cancel
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Pass the phone around — pick your name, then tap the items you shared.
        </p>
      </div>

      {/* ── Active-user selector (sticky, big tap targets) ─────── */}
      <div className="px-4 py-3 border-b border-[var(--border)] bg-gray-50 shrink-0">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">
          I am… <span className="text-gray-400 normal-case">(tap your name first)</span>
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {participants.map((p) => {
            const isActive = activeUser === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setActiveUser(p.id)}
                className={`flex items-center gap-1.5 pl-2 pr-3 py-2.5 rounded-full text-sm font-medium shrink-0 transition-all border-2 ${
                  isActive
                    ? "border-[var(--primary)] bg-blue-50 text-[var(--primary)] shadow-sm"
                    : "border-transparent bg-white text-gray-600"
                }`}
              >
                <UserAvatar name={p.name} size="sm" />
                {p.name.split(" ")[0]}
                <span className="font-mono text-xs text-gray-400">
                  ${(participantTotals[p.id] ?? 0).toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active user banner — reinforces whose turn it is */}
      <div className="px-4 py-2 bg-blue-50/70 border-b border-[var(--border)] shrink-0 flex items-center gap-2">
        <span className="text-xs text-gray-500">Assigning items for</span>
        <span className="text-xs font-semibold text-[var(--primary)]">
          {participants.find((p) => p.id === activeUser)?.name ?? "—"}
        </span>
      </div>

      {/* ── Item list ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
        {items.map((item, i) => {
          const cnt = item.cnt ?? 1;
          const isMulti = cnt > 1;
          const unitPrice = item.price / cnt;

          // Active user's assignment state across this item's units
          const unitsAssignedToActive = Array.from({ length: cnt }).filter((_, u) =>
            getUnitSet(unitKey(i, u)).has(activeUser)
          ).length;
          const allAssigned = unitsAssignedToActive === cnt;
          const someAssigned = unitsAssignedToActive > 0;

          return (
            <div key={i}>
              {/* Main item row */}
              <div
                className={`px-4 py-3.5 flex items-center gap-3 transition-colors ${
                  someAssigned ? "bg-blue-50/60" : ""
                }`}
              >
                <button
                  onClick={() => toggleWholeItem(i, cnt)}
                  className="flex-1 min-w-0 text-left py-0.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center text-[10px] ${
                        allAssigned
                          ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                          : someAssigned
                          ? "border-[var(--primary)] bg-blue-100 text-[var(--primary)]"
                          : "border-gray-300"
                      }`}
                    >
                      {allAssigned ? "✓" : someAssigned ? "–" : ""}
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {item.nm}
                    </span>
                    {isMulti && (
                      <span className="text-xs text-gray-400 shrink-0">×{cnt}</span>
                    )}
                  </div>
                  {!isMulti && (
                    <div className="flex items-center gap-1 mt-1.5 pl-7 min-h-[18px]">
                      {getUnitSet(unitKey(i, 0)).size === 0 ? (
                        <span className="text-[11px] text-gray-400">Not assigned yet</span>
                      ) : (
                        <>
                          {renderAvatars(getUnitSet(unitKey(i, 0)))}
                          <span className="text-[10px] text-gray-400 ml-1">
                            ${(unitPrice / getUnitSet(unitKey(i, 0)).size).toFixed(2)} each
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </button>

                {/* Editable item price */}
                <div className="relative shrink-0">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    $
                  </span>
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) => updateItemPrice(i, parseFloat(e.target.value) || 0)}
                    step="0.01"
                    min="0"
                    className="w-24 pl-5 pr-2 py-1.5 text-sm text-right font-mono border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>

                {/* Expand toggle for multi-qty items */}
                {isMulti && (
                  <button
                    onClick={() => toggleExpand(i)}
                    className="text-xs text-[var(--primary)] shrink-0 w-5 text-center"
                    aria-label="Toggle units"
                  >
                    {expanded.has(i) ? "▲" : "▼"}
                  </button>
                )}
              </div>

              {/* Sub-rows: one per unit (only for multi-qty, when expanded) */}
              {isMulti && expanded.has(i) && (
                <div className="bg-gray-50/60">
                  {Array.from({ length: cnt }).map((_, u) => {
                    const assigned = getUnitSet(unitKey(i, u));
                    const activeOn = assigned.has(activeUser);
                    return (
                      <button
                        key={u}
                        onClick={() => toggleUnit(i, u)}
                        className={`w-full pl-10 pr-4 py-2.5 flex items-center gap-3 text-left border-t border-[var(--border)] transition-colors ${
                          activeOn ? "bg-blue-50/80" : ""
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center text-[9px] ${
                            activeOn
                              ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                              : "border-gray-300"
                          }`}
                        >
                          {activeOn ? "✓" : ""}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-gray-600">
                            {item.nm} #{u + 1}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5 min-h-[16px]">
                            {assigned.size === 0 ? (
                              <span className="text-[10px] text-gray-400">unassigned</span>
                            ) : (
                              <>
                                {renderAvatars(assigned)}
                                <span className="text-[10px] text-gray-400 ml-1">
                                  ${(unitPrice / assigned.size).toFixed(2)} each
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-mono text-gray-500 shrink-0">
                          ${unitPrice.toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer summary + confirm (safe-area aware) ─────────── */}
      <div
        className="border-t border-[var(--border)] bg-gray-50 px-4 pt-3 space-y-2 shrink-0"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total bill</span>
          <span className="font-mono font-medium">${totalBill.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Assigned</span>
          <span
            className={`font-mono font-medium ${
              Math.abs(totalAssigned - totalBill) > 0.01
                ? "text-amber-600"
                : "text-[var(--success)]"
            }`}
          >
            ${totalAssigned.toFixed(2)}
          </span>
        </div>
        {unassignedCount > 0 && (
          <p className="text-xs text-amber-600">
            ⚠ {unassignedCount} item{unassignedCount > 1 ? "s/units" : "/unit"} still
            have nobody assigned
          </p>
        )}
        <button
          onClick={handleConfirm}
          disabled={unassignedCount > 0}
          className="w-full px-4 py-3.5 text-base font-semibold text-white bg-[var(--primary)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Confirm assignments
        </button>
      </div>
    </div>
  );
}
