"use client";

import { useState, useMemo } from "react";
import UserAvatar, { avatarTone } from "@/components/UserAvatar";
import { computeAllocation, unitKey, type UnitState } from "@/lib/allocation";
import { tapLight, tapMedium } from "@/lib/haptics";
import Portal from "@/components/Portal";

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

  const activeParticipant = participants.find((p) => p.id === activeUser);
  const activeTone = activeParticipant
    ? avatarTone(activeParticipant.name)
    : "var(--color-blueberry-600)";

  return (
    <Portal>
    <div className="fixed inset-0 z-50 bg-canvas md:max-w-3xl md:mx-auto flex flex-col overscroll-none">
      {/* ── Whose turn it is ─────────────────────────────────────
             The band takes the active person's own colour and cross-fades
             when you hand the phone over. Passing it should feel like handing
             someone a controller, not tapping a chip in a scroll rail. */}
      <div
        className="px-4 pb-4 shrink-0 transition-colors duration-300"
        style={{
          paddingTop: "max(1rem, env(safe-area-inset-top))",
          background: activeTone,
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-caption font-semibold uppercase tracking-wider text-white/70">
            Assigning for
          </span>
          <button
            onClick={onCancel}
            className="pressable text-subhead font-medium text-white/90 -m-2 p-2"
          >
            Cancel
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <span className="rounded-full p-[2px] bg-white/25">
            <UserAvatar name={activeParticipant?.name ?? "?"} size="lg" />
          </span>
          <div className="min-w-0">
            <p className="text-title1 font-bold text-white truncate leading-tight">
              {activeParticipant?.name ?? "—"}
            </p>
            <p className="text-subhead text-white/75">Tap everything you had</p>
          </div>
        </div>

        {/* Live tally — everyone's running total, active one enlarged. */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
          {participants.map((p) => {
            const isActive = activeUser === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  tapLight();
                  setActiveUser(p.id);
                }}
                aria-pressed={isActive}
                className="pressable shrink-0 flex items-center gap-2 rounded-full transition-all"
                style={{
                  minHeight: 44,
                  paddingInline: 12,
                  background: isActive ? "white" : "rgba(255,255,255,0.18)",
                  color: isActive ? "var(--color-ink)" : "white",
                  transform: isActive ? "scale(1)" : "scale(0.94)",
                }}
              >
                <UserAvatar name={p.name} size="sm" />
                <span className="text-subhead font-medium">
                  {p.name.split(" ")[0]}
                </span>
                <span className="text-subhead font-semibold tabular">
                  ${(participantTotals[p.id] ?? 0).toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="receipt-edge-top shrink-0" />

      {/* ── The receipt ────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ background: "var(--color-surface-raised)" }}
      >
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

          // Anyone at all on this item, not just the active person.
          const claimedByAnyone = Array.from({ length: cnt }).some(
            (_, u) => getUnitSet(unitKey(i, u)).size > 0
          );

          return (
            <div key={i}>
              {/* Main item row */}
              <div
                data-unclaimed={!claimedByAnyone}
                className={`px-4 py-3 flex items-center gap-2 transition-colors ${
                  !claimedByAnyone ? "unclaimed-pulse" : ""
                }`}
                style={{
                  borderLeft: `3px solid ${
                    someAssigned ? activeTone : "transparent"
                  }`,
                }}
              >
                <button
                  onClick={() => {
                    tapLight();
                    toggleWholeItem(i, cnt);
                  }}
                  className="flex-1 min-w-0 text-left"
                  style={{ minHeight: 44 }}
                >
                  <div className="flex items-baseline">
                    <span className="text-body text-ink truncate font-mono">
                      {item.nm}
                    </span>
                    {isMulti && (
                      <span className="text-footnote text-ink-muted shrink-0 ml-1.5 font-mono">
                        ×{cnt}
                      </span>
                    )}
                    <span className="leader" aria-hidden />
                  </div>

                  {/* Avatar stamps replace the tri-state checkbox: the faces
                      already say who's on this item, and a 5×5 box couldn't
                      be read at arm's length across a table. */}
                  <div className="flex items-center gap-1 mt-1 min-h-[22px]">
                    {!claimedByAnyone ? (
                      <span className="text-footnote text-ink-muted">
                        Nobody yet
                      </span>
                    ) : !isMulti ? (
                      <>
                        <span className="flex -space-x-1.5">
                          {renderAvatars(getUnitSet(unitKey(i, 0)))}
                        </span>
                        <span className="text-footnote text-ink-muted ml-1.5 tabular">
                          ${(unitPrice / getUnitSet(unitKey(i, 0)).size).toFixed(2)} each
                        </span>
                      </>
                    ) : (
                      <span className="text-footnote text-ink-muted">
                        {unitsAssignedToActive > 0
                          ? `You're on ${unitsAssignedToActive} of ${cnt}`
                          : `${cnt} units — tap to take all`}
                      </span>
                    )}
                  </div>
                </button>

                {/* Editable item price */}
                <input
                  type="number"
                  value={item.price}
                  onChange={(e) => updateItemPrice(i, parseFloat(e.target.value) || 0)}
                  step="0.01"
                  min="0"
                  aria-label={`Price of ${item.nm}`}
                  className="w-[86px] px-2 text-body text-right font-mono tabular text-ink bg-transparent rounded-[8px] focus:outline-none focus:bg-canvas focus:ring-2 focus:ring-blueberry-500 shrink-0"
                  style={{ minHeight: 44 }}
                />

                {/* Expand toggle for multi-qty items */}
                {isMulti && (
                  <button
                    onClick={() => toggleExpand(i)}
                    className="pressable shrink-0 flex items-center justify-center text-ink-muted"
                    style={{ width: 32, minHeight: 44 }}
                    aria-label={expanded.has(i) ? "Hide units" : "Show units"}
                    aria-expanded={expanded.has(i)}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transform: expanded.has(i) ? "rotate(180deg)" : "none",
                        transition: "transform 160ms ease-out",
                      }}
                      aria-hidden
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Sub-rows: one per unit (only for multi-qty, when expanded).
                  Interaction contract is unchanged — the main row above still
                  toggles every unit, each sub-row still toggles just its own. */}
              {isMulti && expanded.has(i) && (
                <div style={{ background: "var(--color-canvas)" }}>
                  {Array.from({ length: cnt }).map((_, u) => {
                    const assigned = getUnitSet(unitKey(i, u));
                    const activeOn = assigned.has(activeUser);
                    return (
                      <button
                        key={u}
                        onClick={() => {
                          tapLight();
                          toggleUnit(i, u);
                        }}
                        aria-pressed={activeOn}
                        className="w-full pl-8 pr-4 flex items-center gap-3 text-left transition-colors"
                        style={{
                          minHeight: 48,
                          borderLeft: `3px solid ${
                            activeOn ? activeTone : "transparent"
                          }`,
                        }}
                      >
                        <div className="flex-1 min-w-0 flex items-baseline">
                          <span className="text-subhead text-ink-muted font-mono">
                            #{u + 1}
                          </span>
                          <span className="leader" aria-hidden />
                        </div>
                        <span className="flex -space-x-1.5 shrink-0">
                          {assigned.size === 0 ? (
                            <span className="text-footnote text-ink-muted">
                              free
                            </span>
                          ) : (
                            renderAvatars(assigned)
                          )}
                        </span>
                        <span className="text-subhead font-mono tabular text-ink-muted shrink-0 w-16 text-right">
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

      <div className="receipt-edge-bottom shrink-0" />

      {/* ── Total + confirm (safe-area aware) ──────────────────── */}
      <div
        className="bg-canvas px-4 pt-3 shrink-0"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-baseline mb-1">
          <span className="text-subhead text-ink-muted">Assigned</span>
          <span className="leader" aria-hidden />
          <span
            className="text-body font-semibold font-mono tabular"
            style={{
              color:
                Math.abs(totalAssigned - totalBill) > 0.01
                  ? "var(--color-warning)"
                  : "var(--color-positive)",
            }}
          >
            ${totalAssigned.toFixed(2)}
          </span>
          <span className="text-subhead text-ink-muted font-mono tabular ml-1">
            / ${totalBill.toFixed(2)}
          </span>
        </div>

        {unassignedCount > 0 && (
          // Tapping the warning scrolls to the first unclaimed row — the
          // count is useless if you then have to hunt for which ones.
          <button
            onClick={() => {
              document
                .querySelector('[data-unclaimed="true"]')
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            className="pressable w-full text-left text-footnote mb-2"
            style={{ color: "var(--color-warning)", minHeight: 30 }}
          >
            {unassignedCount} {unassignedCount > 1 ? "items" : "item"} still
            unclaimed — tap to find {unassignedCount > 1 ? "them" : "it"}
          </button>
        )}

        <button
          onClick={() => {
            tapMedium();
            handleConfirm();
          }}
          disabled={unassignedCount > 0}
          className="pressable w-full rounded-[12px] text-body font-semibold text-white disabled:opacity-40"
          style={{ minHeight: 52, background: "var(--color-blueberry-600)" }}
        >
          {unassignedCount > 0 ? "Assign every item first" : "Done — that's everyone"}
        </button>
      </div>
    </div>
    </Portal>
  );
}
