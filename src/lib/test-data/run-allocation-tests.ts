/**
 * Test runner for the receipt item-allocation math.
 *
 * Runs every fixture through `computeAllocation` and verifies the prefilled
 * result (per-user totals + unassigned count) against the fixture's expected
 * values, plus structural invariants (money conserved, no negatives). Pure and
 * in-memory. Used by both the CLI (`npm run test:allocation`) and the debug
 * API endpoint.
 */
import { computeAllocation } from "../allocation";
import { deriveScannedAdjustments, lineAmount } from "../adjustments";
import {
  ALLOCATION_FIXTURES,
  PREFILL_FIXTURES,
  type AllocationFixture,
  type PrefillFixture,
} from "./allocation-fixtures";

export interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface CaseResult {
  name: string;
  description: string;
  itemCount: number;
  totals: Record<string, number>;
  expectedTotals: Record<string, number>;
  unassignedUnits: number;
  checks: CheckResult[];
  passed: boolean;
}

export interface SuiteResult {
  total: number;
  passed: number;
  failed: number;
  cases: CaseResult[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function runCase(fixture: AllocationFixture): CaseResult {
  const adjustment = fixture.adjustment ?? 0;
  const { assignmentsByItem, totals, unassignedUnits } = computeAllocation(
    fixture.items,
    fixture.unitState,
    adjustment
  );
  const checks: CheckResult[] = [];

  // 1. Per-user totals match the expected prefilled split.
  const users = new Set([
    ...Object.keys(totals),
    ...Object.keys(fixture.expectedTotals),
  ]);
  let totalsOk = true;
  let totalsDetail = "";
  for (const uid of users) {
    const got = round2(totals[uid] ?? 0);
    const want = round2(fixture.expectedTotals[uid] ?? 0);
    if (Math.abs(got - want) > 0.01) {
      totalsOk = false;
      totalsDetail = `${uid}: expected ${want.toFixed(2)}, got ${got.toFixed(2)}`;
      break;
    }
  }
  checks.push({
    name: "per-user totals match",
    passed: totalsOk,
    detail: totalsOk ? undefined : totalsDetail,
  });

  // 2. Unassigned-unit count matches (defaults to 0).
  const expectedUnassigned = fixture.expectedUnassigned ?? 0;
  checks.push({
    name: `${expectedUnassigned} unassigned unit(s)`,
    passed: unassignedUnits === expectedUnassigned,
    detail:
      unassignedUnits === expectedUnassigned
        ? undefined
        : `got ${unassignedUnits}`,
  });

  // 3. Conservation — the sum of every per-item share equals the price of the
  //    assigned portion of that item (assigned units × unit price).
  let conservationOk = true;
  let conservationDetail = "";
  fixture.items.forEach((item, i) => {
    const cnt = item.cnt ?? 1;
    const unitPrice = item.price / cnt;
    let assignedUnits = 0;
    for (let u = 0; u < cnt; u++) {
      if ((fixture.unitState[`${i}:${u}`] ?? []).length > 0) assignedUnits++;
    }
    const expectedItemSum = round2(assignedUnits * unitPrice);
    const gotItemSum = round2(
      (assignmentsByItem[i] ?? []).reduce((s, a) => s + a.shareAmount, 0)
    );
    // Shares must sum to the item's assigned value *exactly* to the cent —
    // a looser tolerance would hide penny-drift that breaks saving.
    if (Math.abs(gotItemSum - expectedItemSum) > 0.005) {
      conservationOk = false;
      conservationDetail = `${item.nm}: shares sum ${gotItemSum.toFixed(2)} ≠ assigned value ${expectedItemSum.toFixed(2)}`;
    }
  });
  checks.push({
    name: "item shares conserved (exact)",
    passed: conservationOk,
    detail: conservationOk ? undefined : conservationDetail,
  });

  // 4. Receipt-wide conservation — mirrors the backend's real save check:
  //    the sum of every user's total must equal the assigned value of the
  //    whole receipt *plus the tax/discount*, or the prefilled split can't be
  //    saved. This is the check that would have caught tax going missing.
  const assignedReceiptValue = round2(
    fixture.items.reduce((sum, item, i) => {
      const cnt = item.cnt ?? 1;
      const unitPrice = item.price / cnt;
      let assignedUnits = 0;
      for (let u = 0; u < cnt; u++) {
        if ((fixture.unitState[`${i}:${u}`] ?? []).length > 0) assignedUnits++;
      }
      return sum + assignedUnits * unitPrice;
    }, 0)
  );
  const expectedReceiptTotal = round2(assignedReceiptValue + adjustment);
  const totalsSum = round2(Object.values(totals).reduce((s, v) => s + v, 0));
  const receiptConserved = Math.abs(totalsSum - expectedReceiptTotal) <= 0.01;
  checks.push({
    name: "receipt total conserved (saveable)",
    passed: receiptConserved,
    detail: receiptConserved
      ? undefined
      : `totals sum ${totalsSum.toFixed(2)} ≠ assigned value + adjustment ${expectedReceiptTotal.toFixed(2)}`,
  });

  // 5. No negative shares.
  const negative = assignmentsByItem
    .flat()
    .find((a) => a.shareAmount < 0);
  checks.push({
    name: "no negative shares",
    passed: !negative,
    detail: negative ? `${negative.userId}: ${negative.shareAmount}` : undefined,
  });

  return {
    name: fixture.name,
    description: fixture.description,
    itemCount: fixture.items.length,
    totals,
    expectedTotals: fixture.expectedTotals,
    unassignedUnits,
    checks,
    passed: checks.every((c) => c.passed),
  };
}

/**
 * Prefill cases share the CaseResult shape so the CLI and the /debug page
 * render them alongside the allocation cases with no extra plumbing. There's
 * no per-user split to report, so `totals` carries the single derived
 * adjustment instead.
 */
function runPrefillCase(fixture: PrefillFixture): CaseResult {
  const itemsSum = fixture.receipt.menu.reduce((s, it) => s + it.price, 0);
  const adj = deriveScannedAdjustments(fixture.receipt);
  const gotTax = round2(lineAmount(adj.tax, itemsSum));
  const gotDiscount = round2(lineAmount(adj.discount, itemsSum));
  const gotMisc = round2(lineAmount(adj.misc, itemsSum));

  const checks: CheckResult[] = [
    {
      name: "tax line matches",
      passed: Math.abs(gotTax - fixture.expectedTax) < 0.01,
      detail: `expected ${fixture.expectedTax.toFixed(2)}, got ${gotTax.toFixed(2)}`,
    },
    {
      name: "discount line matches",
      passed: Math.abs(gotDiscount - fixture.expectedDiscount) < 0.01,
      detail: `expected ${fixture.expectedDiscount.toFixed(2)}, got ${gotDiscount.toFixed(2)}`,
    },
    // Nothing on the receipt maps to "other", so a prefill that puts a value
    // there has invented one.
    {
      name: "other line stays empty",
      passed: gotMisc === 0,
      detail: `got ${gotMisc.toFixed(2)}`,
    },
    // The whole point of the prefill rule: the page must open in a state that
    // already adds up, or the user lands on a blocked Done button.
    {
      name: "prefill reconciles to the printed total",
      passed:
        Math.abs(itemsSum + gotTax + gotMisc - gotDiscount - fixture.receipt.total_price) <
        0.01,
      detail: `items ${itemsSum.toFixed(2)} + ${gotTax.toFixed(2)} − ${gotDiscount.toFixed(2)} ≠ ${fixture.receipt.total_price.toFixed(2)}`,
    },
  ].map((c) => ({ ...c, detail: c.passed ? undefined : c.detail }));

  return {
    name: fixture.name,
    description: fixture.description,
    itemCount: fixture.receipt.menu.length,
    totals: { tax: gotTax, discount: gotDiscount },
    expectedTotals: { tax: fixture.expectedTax, discount: fixture.expectedDiscount },
    unassignedUnits: 0,
    checks,
    passed: checks.every((c) => c.passed),
  };
}

/** Run all fixtures and return a structured result. */
export function runAllocationTests(): SuiteResult {
  const cases = [
    ...ALLOCATION_FIXTURES.map(runCase),
    ...PREFILL_FIXTURES.map(runPrefillCase),
  ];
  const passed = cases.filter((c) => c.passed).length;
  return {
    total: cases.length,
    passed,
    failed: cases.length - passed,
    cases,
  };
}
