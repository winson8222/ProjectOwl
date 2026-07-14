/**
 * Pure receipt-allocation math.
 *
 * Given a set of scanned items and a per-unit assignment of users, computes:
 *  - each item's per-user share amounts (uneven when a multi-quantity item's
 *    units go to different people)
 *  - each user's overall total across the whole receipt
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
  /** Per-item, per-user resolved share amounts — index matches items[]. */
  assignmentsByItem: { userId: string; shareAmount: number }[][];
  /** Per-user overall totals across the whole receipt. */
  totals: Record<string, number>;
  /** Count of units that have nobody assigned. */
  unassignedUnits: number;
}

/** Key for a single unit of an item. Shared with the ItemAssigner component. */
export const unitKey = (itemIndex: number, unitIndex: number) =>
  `${itemIndex}:${unitIndex}`;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Resolve item assignments into per-item and per-user share amounts.
 *
 * Each item's price is divided evenly across its units (price / cnt). Each
 * unit's cost is then split evenly among whoever is assigned to that unit.
 * A user's share of an item is the sum of their per-unit shares; their overall
 * total is the sum across all items.
 */
export function computeAllocation(items: AllocItem[], unitState: UnitState): AllocationResult {
  const assignmentsByItem: { userId: string; shareAmount: number }[][] = [];
  const totals: Record<string, number> = {};
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

    // Round each user's share to whole cents using the largest-remainder
    // method so the shares sum *exactly* to the item's assigned value. This
    // prevents penny drift that would otherwise make the prefilled split fail
    // the backend's total-must-match validation (e.g. $10 split 6 ways).
    const targetCents = Math.round(assignedUnits * unitPrice * 100);
    const entries = Object.entries(rawShares).map(([userId, amt]) => {
      const exact = amt * 100;
      const floor = Math.floor(exact);
      return { userId, floor, remainder: exact - floor };
    });

    const distributed = entries.reduce((s, e) => s + e.floor, 0);
    let leftover = targetCents - distributed;
    // Hand out the remaining cents to the largest fractional remainders first.
    // Ties (equal remainders, e.g. an item split evenly) are broken by a
    // per-item rotating offset so the leftover penny doesn't always land on
    // the same person across a multi-item receipt.
    entries.sort((a, b) => {
      if (Math.abs(a.remainder - b.remainder) > 1e-9) return b.remainder - a.remainder;
      return 0; // preserve insertion order for genuine ties
    });
    const start = entries.length > 0 ? i % entries.length : 0;
    for (let k = 0; k < entries.length && leftover > 0; k++) {
      entries[(start + k) % entries.length].floor += 1;
      leftover--;
    }

    const itemAssignments = entries.map((e) => ({
      userId: e.userId,
      shareAmount: e.floor / 100,
    }));

    // Keep a stable, readable order (by userId) in the output.
    itemAssignments.sort((a, b) => a.userId.localeCompare(b.userId));
    assignmentsByItem.push(itemAssignments);

    // Totals are summed from the already-rounded per-item shares, so the grand
    // total is conserved to the cent as well.
    for (const a of itemAssignments) {
      totals[a.userId] = round2((totals[a.userId] ?? 0) + a.shareAmount);
    }
  });

  return { assignmentsByItem, totals, unassignedUnits };
}
