/**
 * Test fixtures for the receipt item-allocation math.
 *
 * Each fixture is a self-contained scenario: a scanned receipt (items) plus a
 * per-unit assignment of users (`unitState`), together with the expected
 * prefilled result — per-user totals and, optionally, per-item shares.
 *
 * These are pure in-memory scenarios exercising `computeAllocation`. Nothing
 * here touches the database or the LLM, so running them is free and has no
 * side effects. They also double as the payloads for the "mock scan" debug
 * mode — see `mockReceipt` on each fixture.
 */
import type { AllocItem, UnitState } from "../allocation";
import { unitKey } from "../allocation";
import type { ScannedReceiptTotals } from "../adjustments";
import type { ReceiptExtractionResult } from "../schemas/receipt";

export interface AllocationFixture {
  name: string;
  description: string;
  items: AllocItem[];
  /** Per-unit user assignment. */
  unitState: UnitState;
  /** Signed tax (+) / discount (−) spread over the receipt. Defaults to 0. */
  adjustment?: number;
  /** Expected per-user totals after allocation (the prefilled custom split). */
  expectedTotals: Record<string, number>;
  /** Expected count of unassigned units (defaults to 0). */
  expectedUnassigned?: number;
}

// Readable participant ids for the scenarios below.
const A = "user-you";
const B = "user-alex";
const C = "user-ben";

export const ALLOCATION_FIXTURES: AllocationFixture[] = [
  {
    name: "single-item-shared",
    description: "One $60 pizza shared by two people → $30 each.",
    items: [{ nm: "Pizza", price: 60 }],
    unitState: { [unitKey(0, 0)]: [A, B] },
    expectedTotals: { [A]: 30, [B]: 30 },
  },
  {
    name: "single-item-solo",
    description: "One $18 dish taken entirely by one person.",
    items: [{ nm: "Steak", price: 18 }],
    unitState: { [unitKey(0, 0)]: [A] },
    expectedTotals: { [A]: 18 },
  },
  {
    name: "two-items-different-people",
    description: "Pizza ($60) → You; Salad ($40) → Alex. No overlap.",
    items: [
      { nm: "Pizza", price: 60 },
      { nm: "Salad", price: 40 },
    ],
    unitState: { [unitKey(0, 0)]: [A], [unitKey(1, 0)]: [B] },
    expectedTotals: { [A]: 60, [B]: 40 },
  },
  {
    name: "multi-qty-split-across-people",
    description: "Ramen ×2 ($28) — You take one unit, Alex the other → $14 each.",
    items: [{ nm: "Ramen", price: 28, cnt: 2 }],
    unitState: { [unitKey(0, 0)]: [A], [unitKey(0, 1)]: [B] },
    expectedTotals: { [A]: 14, [B]: 14 },
  },
  {
    name: "multi-qty-whole-item-shared",
    description: "Ramen ×2 ($28) — both units shared by both people → $14 each.",
    items: [{ nm: "Ramen", price: 28, cnt: 2 }],
    unitState: { [unitKey(0, 0)]: [A, B], [unitKey(0, 1)]: [A, B] },
    expectedTotals: { [A]: 14, [B]: 14 },
  },
  {
    name: "multi-qty-uneven",
    description:
      "Beer ×3 ($30) — You get 2 units, Alex gets 1 → You $20, Alex $10.",
    items: [{ nm: "Beer", price: 30, cnt: 3 }],
    unitState: {
      [unitKey(0, 0)]: [A],
      [unitKey(0, 1)]: [A],
      [unitKey(0, 2)]: [B],
    },
    expectedTotals: { [A]: 20, [B]: 10 },
  },
  {
    name: "mixed-receipt-three-people",
    description:
      "Pizza ($60) all three; Wine ($30) You+Alex; Dessert ($9) Ben solo.",
    items: [
      { nm: "Pizza", price: 60 },
      { nm: "Wine", price: 30 },
      { nm: "Dessert", price: 9 },
    ],
    unitState: {
      [unitKey(0, 0)]: [A, B, C],
      [unitKey(1, 0)]: [A, B],
      [unitKey(2, 0)]: [C],
    },
    // Pizza: 20 each. Wine: 15 each for A,B. Dessert: 9 for C.
    expectedTotals: { [A]: 35, [B]: 35, [C]: 29 },
  },
  {
    name: "rounding-thirds",
    description:
      "A $10 item split three ways → shares must sum to exactly $10.00, so one person absorbs the extra cent (3.34 / 3.33 / 3.33).",
    items: [{ nm: "Nachos", price: 10 }],
    unitState: { [unitKey(0, 0)]: [A, B, C] },
    // 10/3 = 3.333… — largest-remainder rounding gives the leftover cent to
    // exactly one person so the shares total $10.00 (not $9.99).
    expectedTotals: { [A]: 3.34, [B]: 3.33, [C]: 3.33 },
  },
  {
    // Regression: independent per-share rounding overshot to $10.02 here,
    // which broke saving (backend rejects a split that doesn't equal total).
    name: "rounding-sixths",
    description: "A $10 item split six ways must sum to exactly $10.00.",
    items: [{ nm: "Platter", price: 10 }],
    unitState: {
      [unitKey(0, 0)]: [A, B, C, "user-diana", "user-eve", "user-frank"],
    },
    // 10/6 = 1.666… → four people pay 1.67, two pay 1.66 → $10.00 exactly.
    expectedTotals: {
      [A]: 1.67,
      [B]: 1.67,
      [C]: 1.67,
      "user-diana": 1.67,
      "user-eve": 1.66,
      "user-frank": 1.66,
    },
  },
  {
    name: "partial-unassigned",
    description:
      "Two items but only one assigned — the other is flagged unassigned.",
    items: [
      { nm: "Assigned", price: 20 },
      { nm: "Forgotten", price: 15 },
    ],
    unitState: { [unitKey(0, 0)]: [A] },
    expectedTotals: { [A]: 20 },
    expectedUnassigned: 1,
  },
  {
    name: "tax-proportional",
    description:
      "$100 of food (You $70, Alex $30) plus $10 tax — tax follows what each ordered, not a 50/50 split.",
    items: [
      { nm: "Pizza", price: 70 },
      { nm: "Salad", price: 30 },
    ],
    unitState: { [unitKey(0, 0)]: [A], [unitKey(1, 0)]: [B] },
    adjustment: 10,
    // You carry 70% of the tax ($7), Alex 30% ($3).
    expectedTotals: { [A]: 77, [B]: 33 },
  },
  {
    name: "discount-proportional",
    description:
      "$100 of food (You $60, Alex $40) less a $15 discount — the saving is shared in the same proportion.",
    items: [
      { nm: "Steak", price: 60 },
      { nm: "Wine", price: 40 },
    ],
    unitState: { [unitKey(0, 0)]: [A], [unitKey(1, 0)]: [B] },
    adjustment: -15,
    expectedTotals: { [A]: 51, [B]: 34 },
  },
  {
    name: "tax-rounding-thirds",
    description:
      "A $10 item split three ways with $1 tax — both the item and the tax must land exactly, totalling $11.00.",
    items: [{ nm: "Nachos", price: 10 }],
    unitState: { [unitKey(0, 0)]: [A, B, C] },
    adjustment: 1,
    // Item: 3.34 / 3.33 / 3.33. Tax: 0.34 / 0.33 / 0.33 — the stray cent goes
    // to the largest remainder, so the totals sum to exactly $11.00.
    expectedTotals: { [A]: 3.68, [B]: 3.66, [C]: 3.66 },
  },
];

/**
 * Fixtures for `deriveScannedAdjustment` — what tax/discount the allocation
 * page opens prefilled with, given what the scan read off the receipt.
 */
export interface PrefillFixture {
  name: string;
  description: string;
  receipt: ScannedReceiptTotals;
  /** Expected resolved dollar amounts on each line. */
  expectedTax: number;
  expectedDiscount: number;
}

export const PREFILL_FIXTURES: PrefillFixture[] = [
  {
    name: "prefill-derives-missing-tax",
    description:
      "Receipt with no tax field at all — the $0.97 gap between the items and the printed total becomes the tax.",
    receipt: {
      menu: [{ price: 8.5 }, { price: 3.58 }],
      total_price: 13.05,
    },
    expectedTax: 0.97,
    expectedDiscount: 0,
  },
  {
    name: "prefill-trusts-reconciling-tax",
    description:
      "Scanned tax of $10 agrees with the total, so it's used as-is.",
    receipt: {
      menu: [{ price: 70 }, { price: 30 }],
      tax_price: 10,
      total_price: 110,
    },
    expectedTax: 10,
    expectedDiscount: 0,
  },
  {
    name: "prefill-ignores-double-counted-service",
    description:
      "Service charge listed BOTH as a menu line and as service_price — trusting the field would double-count it to $134.50, so the derived $0 wins.",
    receipt: {
      menu: [{ price: 42 }, { price: 28 }, { price: 12.5 }, { price: 16 }, { price: 18 }],
      service_price: 18,
      total_price: 116.5,
    },
    expectedTax: 0,
    expectedDiscount: 0,
  },
  {
    name: "prefill-discount-onto-its-own-line",
    description: "A $15 discount reconciles, and lands on the discount line.",
    receipt: {
      menu: [{ price: 60 }, { price: 40 }],
      discount_price: 15,
      total_price: 85,
    },
    expectedTax: 0,
    expectedDiscount: 15,
  },
  {
    name: "prefill-tax-and-discount-together",
    description:
      "Both a $12 tax and a $7 voucher on one receipt — they fill separate lines rather than netting to $5.",
    receipt: {
      menu: [{ price: 100 }],
      tax_price: 12,
      discount_price: 7,
      total_price: 105,
    },
    expectedTax: 12,
    expectedDiscount: 7,
  },
];

/**
 * Mock receipts for the "load test data instead of scanning" debug mode.
 *
 * These are shaped exactly like a real `POST /api/receipts/extract` success
 * payload, so the scan flow can consume them without any code-path changes —
 * the create page just skips the network call and feeds one of these in.
 */
export interface MockReceipt {
  name: string;
  label: string;
  data: ReceiptExtractionResult;
}

export const MOCK_RECEIPTS: MockReceipt[] = [
  {
    name: "sakura-dinner",
    label: "Sakura Dinner (5 items)",
    data: {
      menu: [
        { nm: "Sushi Platter", cnt: 1, price: 42.0 },
        { nm: "Ramen", cnt: 2, price: 28.0 },
        { nm: "Gyoza", cnt: 1, price: 12.5 },
        { nm: "Green Tea", cnt: 4, price: 16.0 },
        { nm: "Service Charge", cnt: 1, price: 18.0 },
      ],
      subtotal_price: 98.5,
      service_price: 18.0,
      total_price: 116.5,
    },
  },
  {
    name: "grocery-run",
    label: "Grocery Run (3 items)",
    data: {
      menu: [
        { nm: "Steak", cnt: 2, price: 45.0 },
        { nm: "Wine", cnt: 1, price: 25.5 },
        { nm: "Snacks", cnt: 1, price: 15.0 },
      ],
      subtotal_price: 85.5,
      total_price: 85.5,
    },
  },
  {
    name: "bar-tab",
    label: "Bar Tab (multi-qty)",
    data: {
      menu: [
        { nm: "Beer", cnt: 6, price: 60.0 },
        { nm: "Fries", cnt: 2, price: 16.0 },
        { nm: "Wings", cnt: 1, price: 14.0 },
      ],
      subtotal_price: 90.0,
      total_price: 90.0,
    },
  },
  {
    name: "cafe-with-tax",
    label: "Café (tax, no tax field)",
    // Deliberately has no tax_price: the $0.97 gap between the items and the
    // total has to be derived. Mirrors the receipt that first surfaced the
    // missing-tax bug.
    data: {
      menu: [
        { nm: "Flat White", cnt: 1, price: 8.5 },
        { nm: "Banana Bread", cnt: 1, price: 3.58 },
      ],
      subtotal_price: 12.08,
      total_price: 13.05,
    },
  },
  {
    name: "takeout-discount",
    label: "Takeout (10% off)",
    data: {
      menu: [
        { nm: "Pad Thai", cnt: 2, price: 36.0 },
        { nm: "Spring Rolls", cnt: 1, price: 9.0 },
        { nm: "Mango Sticky Rice", cnt: 1, price: 15.0 },
      ],
      subtotal_price: 60.0,
      discount_price: 6.0,
      total_price: 54.0,
    },
  },
];
