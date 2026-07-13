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
import { ALLOCATION_FIXTURES, type AllocationFixture } from "./allocation-fixtures";

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
  const { assignmentsByItem, totals, unassignedUnits } = computeAllocation(
    fixture.items,
    fixture.unitState
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
  //    whole receipt within a cent, or the prefilled split can't be saved.
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
  const totalsSum = round2(Object.values(totals).reduce((s, v) => s + v, 0));
  const receiptConserved = Math.abs(totalsSum - assignedReceiptValue) <= 0.01;
  checks.push({
    name: "receipt total conserved (saveable)",
    passed: receiptConserved,
    detail: receiptConserved
      ? undefined
      : `totals sum ${totalsSum.toFixed(2)} ≠ assigned receipt value ${assignedReceiptValue.toFixed(2)}`,
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

/** Run all fixtures and return a structured result. */
export function runAllocationTests(): SuiteResult {
  const cases = ALLOCATION_FIXTURES.map(runCase);
  const passed = cases.filter((c) => c.passed).length;
  return {
    total: cases.length,
    passed,
    failed: cases.length - passed,
    cases,
  };
}
