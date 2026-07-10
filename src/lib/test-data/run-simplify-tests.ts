/**
 * Test runner for the debt-simplification algorithm.
 *
 * Runs every fixture through `computeNetBalances` → `minimizeTransfers` and
 * verifies the result against a set of correctness invariants. Pure and
 * in-memory: no database, no server, nothing to clean up. Used by both the
 * CLI (`npm run test:simplify`) and the debug API endpoint.
 */
import {
  computeNetBalances,
  minimizeTransfers,
  EPSILON,
  type NetBalance,
  type Transfer,
} from "../simplify";
import { SIMPLIFY_FIXTURES, type SimplifyFixture } from "./simplify-fixtures";

export interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface CaseResult {
  name: string;
  description: string;
  transactionCount: number;
  netBalances: NetBalance[];
  transfers: Transfer[];
  transferCount: number;
  expectedTransfers?: number;
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

function runCase(fixture: SimplifyFixture): CaseResult {
  const netBalances = computeNetBalances(fixture.transactions);
  const transfers = minimizeTransfers(netBalances);
  const checks: CheckResult[] = [];

  // 1. Conservation — reconstructing net positions from the transfers must
  //    match the computed net balances for every user.
  const reconstructed = new Map<string, number>();
  const bump = (u: string, d: number) => reconstructed.set(u, (reconstructed.get(u) ?? 0) + d);
  for (const t of transfers) {
    bump(t.to, t.amount); // creditor receives
    bump(t.from, -t.amount); // debtor pays
  }
  let conservationOk = true;
  let conservationDetail = "";
  for (const b of netBalances) {
    const got = round2(reconstructed.get(b.userId) ?? 0);
    if (Math.abs(got - b.amount) > 0.01) {
      conservationOk = false;
      conservationDetail = `${b.userId}: expected net ${b.amount.toFixed(2)}, transfers give ${got.toFixed(2)}`;
      break;
    }
  }
  // Also ensure the transfers don't invent balances for users who net to zero.
  for (const [userId, amount] of reconstructed) {
    if (!netBalances.some((b) => b.userId === userId) && Math.abs(round2(amount)) > 0.01) {
      conservationOk = false;
      conservationDetail = `${userId} has transfers but zero net balance`;
      break;
    }
  }
  checks.push({ name: "money conserved", passed: conservationOk, detail: conservationOk ? undefined : conservationDetail });

  // 2. No self-payments.
  const selfLoop = transfers.find((t) => t.from === t.to);
  checks.push({
    name: "no self-payments",
    passed: !selfLoop,
    detail: selfLoop ? `${selfLoop.from} pays itself` : undefined,
  });

  // 3. All transfer amounts are positive.
  const nonPositive = transfers.find((t) => t.amount <= EPSILON);
  checks.push({
    name: "positive amounts",
    passed: !nonPositive,
    detail: nonPositive ? `${nonPositive.from}→${nonPositive.to} is ${nonPositive.amount}` : undefined,
  });

  // 4. Minimal-ish: at most (n-1) transfers for n non-zero balances.
  const nonZero = netBalances.length;
  const upperBound = Math.max(0, nonZero - 1);
  const withinBound = transfers.length <= upperBound;
  checks.push({
    name: "at most n-1 transfers",
    passed: withinBound,
    detail: withinBound ? undefined : `${transfers.length} transfers > bound ${upperBound}`,
  });

  // 5. Exact expected count, when the fixture declares one.
  if (fixture.expectedTransfers !== undefined) {
    const matches = transfers.length === fixture.expectedTransfers;
    checks.push({
      name: `exactly ${fixture.expectedTransfers} transfer(s)`,
      passed: matches,
      detail: matches ? undefined : `got ${transfers.length}`,
    });
  }

  return {
    name: fixture.name,
    description: fixture.description,
    transactionCount: fixture.transactions.length,
    netBalances,
    transfers,
    transferCount: transfers.length,
    expectedTransfers: fixture.expectedTransfers,
    checks,
    passed: checks.every((c) => c.passed),
  };
}

/** Run all fixtures and return a structured result. */
export function runSimplifyTests(): SuiteResult {
  const cases = SIMPLIFY_FIXTURES.map(runCase);
  const passed = cases.filter((c) => c.passed).length;
  return {
    total: cases.length,
    passed,
    failed: cases.length - passed,
    cases,
  };
}
