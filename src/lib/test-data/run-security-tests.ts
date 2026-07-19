/**
 * Test runner for the security-hardening logic.
 *
 * Exercises the real validators the API routes use — `transactionAmountsValid`,
 * `settlementAmountValid`, `clampLimit` (src/lib/security.ts) and
 * `debugEndpointsEnabled` (src/lib/debug-guard.ts) — against declarative
 * fixtures. Pure and in-memory: no server, no database, no UI. Used by the CLI
 * (`npm run test:security`).
 */
import { transactionAmountsValid, settlementAmountValid, clampLimit } from "../security";
import { debugEndpointsEnabled } from "../debug-guard";
import {
  MONEY_FIXTURES,
  SETTLEMENT_AMOUNT_FIXTURES,
  LIMIT_FIXTURES,
  DEBUG_GATE_FIXTURES,
} from "./security-fixtures";

export interface CaseResult {
  group: string;
  name: string;
  description: string;
  passed: boolean;
  detail?: string;
}

export interface SuiteResult {
  total: number;
  passed: number;
  failed: number;
  cases: CaseResult[];
}

/** Run `debugEndpointsEnabled()` with a temporary env, always restoring it. */
function withEnv(env: { NODE_ENV?: string; ALLOW_DEBUG_ENDPOINTS?: string }, fn: () => boolean): boolean {
  const saved = {
    NODE_ENV: process.env.NODE_ENV,
    ALLOW_DEBUG_ENDPOINTS: process.env.ALLOW_DEBUG_ENDPOINTS,
  };
  const mutableEnv = process.env as Record<string, string | undefined>;
  const apply = (key: "NODE_ENV" | "ALLOW_DEBUG_ENDPOINTS", value: string | undefined) => {
    if (value === undefined) delete mutableEnv[key];
    else mutableEnv[key] = value;
  };
  try {
    apply("NODE_ENV", env.NODE_ENV);
    apply("ALLOW_DEBUG_ENDPOINTS", env.ALLOW_DEBUG_ENDPOINTS);
    return fn();
  } finally {
    apply("NODE_ENV", saved.NODE_ENV);
    apply("ALLOW_DEBUG_ENDPOINTS", saved.ALLOW_DEBUG_ENDPOINTS);
  }
}

export function runSecurityTests(): SuiteResult {
  const cases: CaseResult[] = [];

  for (const f of MONEY_FIXTURES) {
    const actual = transactionAmountsValid(f.input);
    cases.push({
      group: "transaction-amounts",
      name: f.name,
      description: f.description,
      passed: actual === f.expectValid,
      detail: actual === f.expectValid ? undefined : `expected valid=${f.expectValid}, got ${actual}`,
    });
  }

  for (const f of SETTLEMENT_AMOUNT_FIXTURES) {
    const actual = settlementAmountValid(f.amount);
    cases.push({
      group: "settlement-amount",
      name: f.name,
      description: f.description,
      passed: actual === f.expectValid,
      detail: actual === f.expectValid ? undefined : `expected valid=${f.expectValid}, got ${actual}`,
    });
  }

  for (const f of LIMIT_FIXTURES) {
    const actual = clampLimit(f.raw);
    cases.push({
      group: "limit-clamp",
      name: f.name,
      description: f.description,
      passed: actual === f.expect,
      detail: actual === f.expect ? undefined : `expected ${f.expect}, got ${actual}`,
    });
  }

  for (const f of DEBUG_GATE_FIXTURES) {
    const actual = withEnv(f.env, () => debugEndpointsEnabled());
    cases.push({
      group: "debug-gate",
      name: f.name,
      description: f.description,
      passed: actual === f.expectEnabled,
      detail: actual === f.expectEnabled ? undefined : `expected enabled=${f.expectEnabled}, got ${actual}`,
    });
  }

  const passed = cases.filter((c) => c.passed).length;
  return { total: cases.length, passed, failed: cases.length - passed, cases };
}
