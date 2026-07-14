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
import type { ReceiptExtractionResult } from "../schemas/receipt";

export interface AllocationFixture {
  name: string;
  description: string;
  items: AllocItem[];
  /** Per-unit user assignment. */
  unitState: UnitState;
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
];
