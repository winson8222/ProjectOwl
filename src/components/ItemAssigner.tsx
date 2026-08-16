"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import UserAvatar, { avatarTone } from "@/components/UserAvatar";
import AdjustmentRow from "@/components/AdjustmentRow";
import CalculatorKeypad from "@/components/CalculatorKeypad";
import {
  ZERO_ADJUSTMENTS,
  lineAmount,
  lineFromAmount,
  netAdjustment,
  type AdjustmentKey,
  type Adjustments,
} from "@/lib/adjustments";
import { computeAllocation, unitKey, type UnitState } from "@/lib/allocation";
import { tapLight, tapMedium } from "@/lib/haptics";

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Which number the calculator keypad is currently editing. */
type NumericTarget =
  | { kind: "item"; index: number }
  | { kind: "total" }
  | { kind: "adjustment"; key: AdjustmentKey };

/** The non-item lines, in the order they'd appear at the foot of a receipt. */
const ADJUSTMENT_ROWS: { key: AdjustmentKey; label: string; negative?: boolean }[] = [
  { key: "tax", label: "Tax" },
  { key: "discount", label: "Discount", negative: true },
  { key: "misc", label: "Other" },
];

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
   *  different people. Item value only — excludes tax/discount. */
  assignmentsByItem: { userId: string; shareAmount: number }[][];
  /** Per-participant final totals, tax/discount included. */
  totals: Record<string, number>;
  /** Raw per-unit assignment state ("<itemIdx>:<unitIdx>" → userIds),
   *  passed back in on re-edit so prior work is preserved exactly. */
  unitState: Record<string, string[]>;
  /** How the tax / discount / other lines were entered, for re-edit. */
  adjustments: Adjustments;
  /** Signed net of those lines in dollars, against the final item prices. */
  adjustmentTotal: number;
  /** The reconciled receipt total (items + adjustments). */
  total: number;
}

interface ItemAssignerProps {
  /** The items as scanned. Stays the "Reset to scan" baseline even after
   *  prices are edited, so reset always means the original receipt. */
  items: ScannedItem[];
  participants: Participant[];
  onConfirm: (result: AssignmentResult) => void;
  /** Step back to the previous wizard step, keeping the draft. */
  onBack: () => void;
  /** Abandon the whole expense. */
  onCancel: () => void;
  /** Restore previously edited item prices when re-opening to edit. */
  initialEditedItems?: { nm: string; price: number; cnt?: number }[];
  /** Restore prior per-unit assignments when re-opening to edit. */
  initialUnitState?: Record<string, string[]>;
  /** Tax/discount read off the receipt, used as the starting value and as
   *  what "Reset to scan" restores. */
  scannedAdjustments?: Adjustments;
  /** Total printed on the receipt — the figure everything must reconcile to. */
  scannedTotal?: number;
  /** Restore previously edited tax/discount lines when re-opening to edit. */
  initialAdjustments?: Adjustments;
  /** Restore a previously edited total when re-opening to edit. */
  initialTotal?: number;
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
  items: scannedItems,
  participants,
  onConfirm,
  onBack,
  onCancel,
  initialEditedItems,
  initialUnitState,
  scannedAdjustments = ZERO_ADJUSTMENTS,
  scannedTotal,
  initialAdjustments,
  initialTotal,
}: ItemAssignerProps) {
  // Editable items (prices stay editable at this stage)
  const [items, setItems] = useState(() =>
    (initialEditedItems ?? scannedItems).map((it) => ({
      nm: it.nm,
      price: it.price,
      cnt: it.cnt ?? 1,
    }))
  );

  // Every number on this screen is entered through the calculator keypad
  // rather than the OS keyboard: it handles "12.50+3" for a shared dish, and
  // it doesn't cover the row you're editing on a phone.
  const [keypadTarget, setKeypadTarget] = useState<NumericTarget | null>(null);

  // This screen renders through a portal (see the return), which can't happen
  // during SSR — there's no document to portal into.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Tax / discount / other, as entered. Seeded from the scan and restored
  // verbatim when re-opening to edit.
  const [adjustments, setAdjustments] = useState<Adjustments>(
    () => initialAdjustments ?? scannedAdjustments
  );

  // Lines the user opened but hasn't typed into yet. A line that carries a
  // value shows regardless — an empty row per line would spend a third of a
  // phone's footer saying "$0.00" three times.
  const [revealed, setRevealed] = useState<Set<AdjustmentKey>>(new Set());

  // The receipt total everything has to reconcile to. Editable because scans
  // misread totals, and being unable to correct it would strand the user.
  const scanTotal =
    scannedTotal ??
    scannedItems.reduce((s, it) => s + it.price, 0) +
      netAdjustment(scannedAdjustments, scannedItems.reduce((s, it) => s + it.price, 0));
  const [total, setTotal] = useState<number>(() => initialTotal ?? scanTotal);

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

  /**
   * Correcting an item price or a tax line moves what the meal actually cost,
   * so the total follows it rather than sitting there stale and forcing a
   * reconcile. Only editing the total *itself* asserts a figure the rest of
   * the bill has to be argued into matching.
   */
  const applyItems = (next: typeof items) => {
    const nextSum = next.reduce((s, it) => s + it.price, 0);
    setItems(next);
    setTotal(round2(nextSum + netAdjustment(adjustments, nextSum)));
  };

  const applyAdjustments = (next: Adjustments) => {
    setAdjustments(next);
    setTotal(round2(itemsSum + netAdjustment(next, itemsSum)));
  };

  const updateItemPrice = (itemIndex: number, price: number) => {
    const next = [...items];
    next[itemIndex] = { ...next[itemIndex], price };
    applyItems(next);
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

  const itemsSum = items.reduce((s, i) => s + i.price, 0);
  const adjustmentTotal = netAdjustment(adjustments, itemsSum);

  // Resolve per-item, per-user shares via the shared allocation function,
  // so the UI shows exactly what the allocation test suite verifies.
  const {
    assignmentsByItem,
    totals: computedTotals,
    itemAdjustments,
    unassignedUnits,
  } = useMemo(
    () => computeAllocation(items, unitState, adjustmentTotal),
    [items, unitState, adjustmentTotal]
  );

  // Ensure every participant appears in the totals (even at $0) for display.
  const participantTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const p of participants) t[p.id] = computedTotals[p.id] ?? 0;
    return t;
  }, [participants, computedTotals]);

  const totalBill = round2(itemsSum + adjustmentTotal);
  const totalAssigned = Object.values(computedTotals).reduce((s, v) => s + v, 0);
  const unassignedCount = unassignedUnits;

  // Items + tax must land on the receipt total before this can be saved —
  // otherwise the split silently wouldn't add up to what was actually paid.
  const offBy = round2(totalBill - total);
  const reconciled = Math.abs(offBy) < 0.01;

  /**
   * Absorb the leftover so the bill lands on the receipt total.
   *
   * Tax is left alone — it's the one line the receipt actually states — and
   * the difference goes to "Other", because a gap of unknown origin is a fee
   * or a rounding, not tax, and labelling it tax would be a guess presented
   * as a fact. If the bill is over the total, Other can't help (it only adds),
   * so the excess becomes a discount instead.
   */
  const absorbGap = () => {
    tapLight();
    const requiredNet = round2(total - itemsSum);
    const tax = lineAmount(adjustments.tax, itemsSum);
    const discount = lineAmount(adjustments.discount, itemsSum);
    const misc = round2(requiredNet - tax + discount);

    setAdjustments(
      misc >= 0
        ? { ...adjustments, misc: lineFromAmount(misc) }
        : {
            ...adjustments,
            misc: lineFromAmount(0),
            discount: lineFromAmount(tax - requiredNet),
          }
    );
  };

  /** A line earns its space by carrying a value, or by being opened to type into. */
  const visibleRows = ADJUSTMENT_ROWS.filter(
    ({ key }) => revealed.has(key) || lineAmount(adjustments[key], itemsSum) !== 0
  );
  const hiddenRows = ADJUSTMENT_ROWS.filter((r) => !visibleRows.includes(r));

  const addLine = (key: AdjustmentKey) => {
    tapLight();
    setRevealed((prev) => new Set(prev).add(key));
  };

  const removeLine = (key: AdjustmentKey) => {
    applyAdjustments({ ...adjustments, [key]: lineFromAmount(0) });
    setRevealed((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const resetToScan = () => {
    tapLight();
    setItems(scannedItems.map((it) => ({ nm: it.nm, price: it.price, cnt: it.cnt ?? 1 })));
    setAdjustments(scannedAdjustments);
    setRevealed(new Set());
    setTotal(scanTotal);
  };

  // What the keypad should open showing, and where its result goes back to.
  const keypadConfig = (() => {
    if (!keypadTarget) return null;
    if (keypadTarget.kind === "item") {
      const item = items[keypadTarget.index];
      return { value: item?.price ?? 0, title: item?.nm ?? "Item price", unit: "$" as const };
    }
    if (keypadTarget.kind === "total") {
      return { value: total, title: "Receipt total", unit: "$" as const };
    }
    const line = adjustments[keypadTarget.key];
    return {
      value: line.value,
      title: ADJUSTMENT_ROWS.find((r) => r.key === keypadTarget.key)?.label ?? "Amount",
      unit: line.mode === "percent" ? ("%" as const) : ("$" as const),
    };
  })();

  const commitKeypad = (value: number) => {
    if (!keypadTarget) return;
    if (keypadTarget.kind === "item") {
      updateItemPrice(keypadTarget.index, value);
    } else if (keypadTarget.kind === "total") {
      setTotal(value);
    } else {
      const key = keypadTarget.key;
      applyAdjustments({ ...adjustments, [key]: { ...adjustments[key], value } });
    }
    setKeypadTarget(null);
  };

  const handleConfirm = () => {
    onConfirm({
      items,
      assignmentsByItem,
      totals: participantTotals,
      unitState,
      adjustments,
      adjustmentTotal,
      total: totalBill,
    });
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

  if (!mounted) return null;

  /**
   * Rendered through a portal to <body>.
   *
   * PageSlider animates its track with a CSS transform, which makes that
   * track the containing block for any `position: fixed` descendant *and*
   * traps their z-index inside its stacking context. Left in place, this
   * screen could never paint above the app header (also z-50, but a sibling
   * of the slider), so the header sat on top of the Back button. Portalling
   * to body takes it out of that stacking context entirely; z-[55] then puts
   * it over the header while staying under the offline banner (z-[60]).
   */
  return createPortal(
    <div className="fixed inset-0 z-[55] bg-canvas md:max-w-3xl md:mx-auto flex flex-col overscroll-none">
      {/* ── Whose turn it is ─────────────────────────────────────
             The band takes the active person's own colour and cross-fades
             when you hand the phone over. Passing it should feel like handing
             someone a controller, not tapping a chip in a scroll rail. */}
      <div
        className="px-4 pb-4 shrink-0 transition-colors duration-300"
        style={{
          // Clear the offline banner, which sits above this screen and would
          // otherwise land on the Back button.
          paddingTop:
            "calc(max(1rem, env(safe-area-inset-top)) + var(--offline-banner-h))",
          background: activeTone,
        }}
      >
        {/* This screen covers the wizard's own chrome, so it has to carry
            both exits itself: step back to the people picker, or drop the
            expense entirely. */}
        <div className="flex items-center justify-between mb-2 -mx-2">
          <button
            onClick={onBack}
            className="pressable text-subhead font-medium text-white/90 px-2"
            style={{ minHeight: 44 }}
          >
            ← Back
          </button>
          <button
            onClick={onCancel}
            className="pressable text-subhead font-medium text-white/90 px-2"
            style={{ minHeight: 44 }}
          >
            Cancel
          </button>
        </div>

        <span className="block text-caption font-semibold uppercase tracking-wider text-white/70 mb-3">
          Assigning for
        </span>

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

                {/* The row's real cost — price plus its slice of tax — with
                    what's baked in shown inline. Tapping swaps to the base
                    price, which is the figure printed on the receipt and so
                    the only one worth typing. */}
                <button
                  onClick={() => {
                    tapLight();
                    setKeypadTarget({ kind: "item", index: i });
                  }}
                  aria-label={`Price of ${item.nm}, ${item.price.toFixed(2)} before tax — tap to change`}
                  className="pressable w-[132px] px-2 flex items-baseline justify-end gap-1.5 rounded-[8px] shrink-0"
                  style={{ minHeight: 44 }}
                >
                  <span className="text-body font-mono tabular text-ink">
                    ${round2(item.price + itemAdjustments[i]).toFixed(2)}
                  </span>
                  {adjustmentTotal !== 0 && (
                    <span className="text-caption font-mono tabular text-ink-muted">
                      (incl. {itemAdjustments[i] >= 0 ? "+" : "−"}
                      {Math.abs(itemAdjustments[i]).toFixed(2)})
                    </span>
                  )}
                </button>

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
                        {/* Same post-tax basis as the parent row, so a unit
                            and the item it came from can be compared. */}
                        <span className="shrink-0 text-right flex items-baseline justify-end gap-1.5">
                          <span className="text-subhead font-mono tabular text-ink-muted">
                            ${round2(unitPrice + itemAdjustments[i] / cnt).toFixed(2)}
                          </span>
                          {adjustmentTotal !== 0 && (
                            <span className="text-caption font-mono tabular text-ink-muted">
                              (incl. {itemAdjustments[i] >= 0 ? "+" : "−"}
                              {Math.abs(itemAdjustments[i] / cnt).toFixed(2)})
                            </span>
                          )}
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
        {/* Items → tax → total, so the arithmetic of the bill is visible
            rather than implied by a single figure. */}
        <div className="flex items-baseline mb-1">
          <span className="text-subhead text-ink-muted">Items</span>
          <span className="leader" aria-hidden />
          <span className="text-subhead font-mono tabular text-ink">
            ${itemsSum.toFixed(2)}
          </span>
        </div>

        {visibleRows.map(({ key, label, negative }) => (
          <AdjustmentRow
            key={key}
            label={label}
            line={adjustments[key]}
            onChange={(line) => applyAdjustments({ ...adjustments, [key]: line })}
            itemsSum={itemsSum}
            negative={negative}
            onRemove={() => removeLine(key)}
            onEdit={() => setKeypadTarget({ kind: "adjustment", key })}
          />
        ))}

        {hiddenRows.length > 0 && (
          <div className="flex flex-wrap gap-1.5 py-1">
            {hiddenRows.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => addLine(key)}
                className="pressable rounded-full px-2.5 text-caption font-semibold text-ink-muted"
                style={{
                  minHeight: 28,
                  background: "var(--color-canvas)",
                  border: "1px solid var(--color-hairline)",
                }}
              >
                + {label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center mt-1 mb-1">
          <span className="text-subhead text-ink-muted shrink-0">Receipt total</span>
          <span className="leader" aria-hidden />
          <button
            onClick={() => {
              tapLight();
              setKeypadTarget({ kind: "total" });
            }}
            aria-label={`Receipt total ${total.toFixed(2)} — tap to change`}
            className="pressable px-2.5 text-body text-right font-mono tabular font-semibold text-ink rounded-lg shrink-0"
            style={{
              minWidth: 100,
              minHeight: 36,
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-hairline)",
            }}
          >
            ${total.toFixed(2)}
          </button>
        </div>

        {!reconciled && (
          // The bill doesn't add up to the printed total. Rather than leave
          // the user to nudge four numbers into agreement by hand, offer the
          // one-tap fix — as a real button, since this is the thing standing
          // between them and a finished split.
          <button
            onClick={absorbGap}
            className="pressable w-full flex items-center gap-2 px-3 rounded-xl my-2"
            style={{
              minHeight: 46,
              background: "var(--color-warning-tint)",
              border: "1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)",
            }}
          >
            <span
              className="shrink-0 text-body font-bold"
              style={{ color: "var(--color-warning)" }}
              aria-hidden
            >
              ⚠
            </span>
            <span className="flex-1 min-w-0 text-left">
              <span
                className="block text-subhead font-semibold"
                style={{ color: "var(--color-warning)" }}
              >
                ${Math.abs(offBy).toFixed(2)} {offBy > 0 ? "over" : "under"} the total
              </span>
              <span className="block text-caption text-ink-muted">
                Tap to absorb the difference
              </span>
            </span>
          </button>
        )}

        <div className="flex items-baseline mb-1">
          <span className="text-subhead text-ink-muted">Assigned</span>
          <button
            onClick={resetToScan}
            className="pressable text-caption font-semibold text-blueberry-600 ml-2 -my-1 py-1"
          >
            Reset to scan
          </button>
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
            className="pressable w-full flex items-center gap-2 px-3 rounded-xl mb-2"
            style={{
              minHeight: 46,
              background: "var(--color-warning-tint)",
              border: "1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)",
            }}
          >
            <span
              className="shrink-0 text-body font-bold"
              style={{ color: "var(--color-warning)" }}
              aria-hidden
            >
              ⚠
            </span>
            <span className="flex-1 min-w-0 text-left">
              <span
                className="block text-subhead font-semibold"
                style={{ color: "var(--color-warning)" }}
              >
                {unassignedCount} {unassignedCount > 1 ? "items" : "item"} still unclaimed
              </span>
              <span className="block text-caption text-ink-muted">
                Tap to find {unassignedCount > 1 ? "them" : "it"}
              </span>
            </span>
          </button>
        )}

        <button
          onClick={() => {
            tapMedium();
            handleConfirm();
          }}
          disabled={unassignedCount > 0 || !reconciled}
          className="pressable-cta w-full rounded-[12px] text-body font-semibold text-white disabled:opacity-40"
          style={{ minHeight: 52, background: "var(--color-blueberry-600)" }}
        >
          {unassignedCount > 0
            ? "Assign every item first"
            : !reconciled
            ? "Make the total match first"
            : "Done — that's everyone"}
        </button>
      </div>

      {keypadConfig && (
        <CalculatorKeypad
          open
          initialValue={keypadConfig.value}
          title={keypadConfig.title}
          unit={keypadConfig.unit}
          onConfirm={commitKeypad}
        />
      )}
    </div>,
    document.body
  );
}
