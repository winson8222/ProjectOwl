/**
 * The non-item lines on a receipt: tax, discount and anything else
 * (delivery, corkage, a tip written on at the bottom).
 *
 * Each is kept as the raw input — "10%" stays 10% rather than collapsing to a
 * dollar figure — so a percentage re-derives correctly when item prices are
 * edited afterwards, and so re-opening the allocation to edit restores exactly
 * what was typed.
 *
 * Pure module: no React, no DOM. `computeAllocation` consumes only the
 * resolved net dollar figure from `netAdjustment`.
 */

export type AdjustmentMode = "amount" | "percent";

export interface AdjustmentLine {
  mode: AdjustmentMode;
  value: number;
}

export interface Adjustments {
  /** Tax and service charge. Added. */
  tax: AdjustmentLine;
  /** Discounts and vouchers. Subtracted. */
  discount: AdjustmentLine;
  /** Anything else — delivery, corkage, tip. Added. */
  misc: AdjustmentLine;
}

export type AdjustmentKey = keyof Adjustments;

const zeroLine = (): AdjustmentLine => ({ mode: "amount", value: 0 });

export const ZERO_ADJUSTMENTS: Adjustments = {
  tax: zeroLine(),
  discount: zeroLine(),
  misc: zeroLine(),
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Resolve one line to dollars. Percentages are of the items' subtotal. */
export function lineAmount(line: AdjustmentLine, itemsSum: number): number {
  return round2(
    line.mode === "percent" ? (itemsSum * line.value) / 100 : line.value
  );
}

/** Signed net of all three lines: tax + misc − discount. */
export function netAdjustment(adj: Adjustments, itemsSum: number): number {
  return round2(
    lineAmount(adj.tax, itemsSum) +
      lineAmount(adj.misc, itemsSum) -
      lineAmount(adj.discount, itemsSum)
  );
}

/** An exact dollar amount as a line (used when absorbing a mismatch). */
export function lineFromAmount(amount: number): AdjustmentLine {
  return { mode: "amount", value: round2(Math.abs(amount)) };
}

/**
 * Switch a line between $ and % while keeping what it's worth.
 *
 * Toggling the unit shouldn't silently change the bill — $10 of tax becomes
 * 10% of a $100 subtotal, not 10% read off the same digits.
 */
export function convertLineMode(
  line: AdjustmentLine,
  itemsSum: number,
  nextMode: AdjustmentMode
): AdjustmentLine {
  if (line.mode === nextMode) return line;

  const amount = lineAmount(line, itemsSum);
  if (nextMode === "percent") {
    return { mode: "percent", value: itemsSum > 0 ? round2((amount / itemsSum) * 100) : 0 };
  }
  return { mode: "amount", value: amount };
}

/** The tax-bearing fields of a scanned receipt. */
export interface ScannedReceiptTotals {
  menu: { price: number }[];
  tax_price?: number;
  service_price?: number;
  discount_price?: number;
  total_price: number;
}

/**
 * Work out what tax / discount lines to prefill the allocation page with.
 *
 * Prefers the scanned tax and discount fields, but only when together they
 * actually reconcile against the printed total. Receipts routinely list a
 * service charge as *both* a menu line item and a `service_price` field, and
 * trusting the field there would double-count it — so when the scanned fields
 * disagree with the total, fall back to the gap between the items and the
 * total, which reconciles by construction and leaves the page in a valid
 * state. A positive gap reads as tax, a negative one as a discount.
 *
 * `misc` is never prefilled: there's no receipt field for it, so it only ever
 * gets a value the user typed or absorbed into it.
 */
export function deriveScannedAdjustments(receipt: ScannedReceiptTotals): Adjustments {
  const itemsSum = receipt.menu.reduce((s, it) => s + (it.price ?? 0), 0);
  const gap = round2(receipt.total_price - itemsSum);

  const scannedTax = round2((receipt.tax_price ?? 0) + (receipt.service_price ?? 0));
  const scannedDiscount = round2(receipt.discount_price ?? 0);
  const hasScannedFields =
    receipt.tax_price != null ||
    receipt.service_price != null ||
    receipt.discount_price != null;

  if (hasScannedFields && Math.abs(scannedTax - scannedDiscount - gap) < 0.01) {
    return {
      tax: lineFromAmount(scannedTax),
      discount: lineFromAmount(scannedDiscount),
      misc: zeroLine(),
    };
  }

  return {
    tax: lineFromAmount(gap > 0 ? gap : 0),
    discount: lineFromAmount(gap < 0 ? -gap : 0),
    misc: zeroLine(),
  };
}
