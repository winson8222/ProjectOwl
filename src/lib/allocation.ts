/**
 * Pure receipt-allocation math.
 *
 * Given a set of scanned items and a per-unit assignment of users, computes:
 *  - each item's per-user share amounts (uneven when a multi-quantity item's
 *    units go to different people)
 *  - each user's overall total across the whole receipt
 *
 * An optional signed `adjustment` (positive = tax/service, negative =
 * discount) is spread across people in proportion to what they ordered, so a
 * receipt's totals reconcile to the printed total rather than the pre-tax
 * subtotal.
 *
 * This is the single source of truth for the "prefilled split" produced after
 * item allocation. The `ItemAssigner` component and the allocation test suite
 * both call this, so what the UI shows is exactly what the tests verify.
 *
 * Nothing here touches React, the DOM, or the database — it's a plain function
 * so it can be unit-tested in isolation.
 */

export interface AllocItem {
  nm: string;
  price: number;
  cnt?: number; // quantity; defaults to 1
}

/** Per-unit assignment: key "<itemIndex>:<unitIndex>" → list of user ids on that unit. */
export type UnitState = Record<string, string[]>;

export interface AllocationResult {
  /** Per-item, per-user resolved share amounts — index matches items[].
   *  Item shares only; the adjustment is not folded in here. */
  assignmentsByItem: { userId: string; shareAmount: number }[][];
  /** Per-user item subtotals, before the adjustment. */
  subtotals: Record<string, number>;
  /** Per-user signed share of the adjustment. */
  adjustmentShares: Record<string, number>;
  /** Per-user final amounts — subtotal + adjustment share. */
  totals: Record<string, number>;
  /** Signed per-item slice of the adjustment, for display beside each row.
   *  Proportional to the item's price; index matches items[]. */
  itemAdjustments: number[];
  /** Count of units that have nobody assigned. */
  unassignedUnits: number;
}

/** Key for a single unit of an item. Shared with the ItemAssigner component. */
export const unitKey = (itemIndex: number, unitIndex: number) =>
  `${itemIndex}:${unitIndex}`;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Round exact per-user amounts to whole cents so they sum to `targetCents`
 * exactly (largest-remainder method).
 *
 * Naive per-user rounding drifts — $10 split 6 ways lands on $9.99 or $10.02 —
 * which then fails the backend's total-must-match validation. Handing the
 * leftover cents to the largest fractional remainders first keeps the sum
 * exact. `tieOffset` rotates who wins a genuine tie (equal remainders, e.g. an
 * item split evenly) so the stray penny doesn't always land on the same person
 * across a multi-item receipt.
 *
 * Works for negative amounts too (discounts): Math.floor pushes away from
 * zero, so remainders stay in [0,1) and leftover stays non-negative.
 */
function distributeCents(
  rawShares: Record<string, number>,
  targetCents: number,
  tieOffset: number
): { userId: string; shareAmount: number }[] {
  const entries = Object.entries(rawShares).map(([userId, amt]) => {
    const exact = amt * 100;
    const floor = Math.floor(exact);
    return { userId, floor, remainder: exact - floor };
  });

  const distributed = entries.reduce((s, e) => s + e.floor, 0);
  let leftover = targetCents - distributed;

  entries.sort((a, b) => {
    if (Math.abs(a.remainder - b.remainder) > 1e-9) return b.remainder - a.remainder;
    return 0; // preserve insertion order for genuine ties
  });

  const start = entries.length > 0 ? tieOffset % entries.length : 0;
  for (let k = 0; k < entries.length && leftover > 0; k++) {
    entries[(start + k) % entries.length].floor += 1;
    leftover--;
  }

  return entries.map((e) => ({ userId: e.userId, shareAmount: e.floor / 100 }));
}

/**
 * Resolve item assignments into per-item and per-user share amounts.
 *
 * Each item's price is divided evenly across its units (price / cnt). Each
 * unit's cost is then split evenly among whoever is assigned to that unit.
 * A user's share of an item is the sum of their per-unit shares; their item
 * subtotal is the sum across all items.
 *
 * `adjustment` is a signed dollar amount for tax/service (positive) or a
 * discount (negative). It's spread in proportion to each person's subtotal —
 * someone who ordered 70% of the food carries 70% of the tax — and added on
 * top to produce their final total. The proportion is taken over the
 * *assigned* subtotal so the numbers stay sensible while units are still
 * unassigned mid-flow.
 */
export function computeAllocation(
  items: AllocItem[],
  unitState: UnitState,
  adjustment: number = 0
): AllocationResult {
  const assignmentsByItem: { userId: string; shareAmount: number }[][] = [];
  const subtotals: Record<string, number> = {};
  let unassignedUnits = 0;

  items.forEach((item, i) => {
    const cnt = item.cnt ?? 1;
    const unitPrice = item.price / cnt;

    // Accumulate each user's exact (unrounded) share of this item.
    const rawShares: Record<string, number> = {};
    let assignedUnits = 0;
    for (let u = 0; u < cnt; u++) {
      const assigned = unitState[unitKey(i, u)] ?? [];
      if (assigned.length === 0) {
        unassignedUnits++;
        continue;
      }
      assignedUnits++;
      const share = unitPrice / assigned.length;
      for (const uid of assigned) {
        rawShares[uid] = (rawShares[uid] ?? 0) + share;
      }
    }

    const itemAssignments = distributeCents(
      rawShares,
      Math.round(assignedUnits * unitPrice * 100),
      i
    );

    // Keep a stable, readable order (by userId) in the output.
    itemAssignments.sort((a, b) => a.userId.localeCompare(b.userId));
    assignmentsByItem.push(itemAssignments);

    // Subtotals are summed from the already-rounded per-item shares, so the
    // grand subtotal is conserved to the cent as well.
    for (const a of itemAssignments) {
      subtotals[a.userId] = round2((subtotals[a.userId] ?? 0) + a.shareAmount);
    }
  });

  // ── Spread the adjustment proportionally over the assigned subtotals ──
  const assignedSubtotal = Object.values(subtotals).reduce((s, v) => s + v, 0);
  let adjustmentShares: Record<string, number> = {};

  if (adjustment !== 0 && assignedSubtotal > 0) {
    const rawAdjustments: Record<string, number> = {};
    for (const [uid, sub] of Object.entries(subtotals)) {
      rawAdjustments[uid] = (adjustment * sub) / assignedSubtotal;
    }
    // No tie offset here: unlike items (which are often split evenly, giving
    // genuine ties worth rotating), adjustment shares are proportional to
    // subtotals, so the largest remainder should simply win.
    for (const a of distributeCents(rawAdjustments, Math.round(adjustment * 100), 0)) {
      adjustmentShares[a.userId] = a.shareAmount;
    }
  } else {
    adjustmentShares = Object.fromEntries(Object.keys(subtotals).map((uid) => [uid, 0]));
  }

  const totals: Record<string, number> = {};
  for (const uid of Object.keys(subtotals)) {
    totals[uid] = round2(subtotals[uid] + (adjustmentShares[uid] ?? 0));
  }

  // Display-only: each item's proportional slice of the adjustment, shown as
  // a "+$1.20" sub-label on the row. Based on the item's price rather than on
  // who's assigned, so the figure is stable while people are still tapping.
  const itemsSum = items.reduce((s, it) => s + it.price, 0);
  const itemAdjustments = items.map((it) =>
    itemsSum > 0 ? round2((adjustment * it.price) / itemsSum) : 0
  );

  return {
    assignmentsByItem,
    subtotals,
    adjustmentShares,
    totals,
    itemAdjustments,
    unassignedUnits,
  };
}

// Prefilling tax/discount from a scanned receipt lives in ./adjustments.
