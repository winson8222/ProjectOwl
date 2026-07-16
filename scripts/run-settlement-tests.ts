/**
 * CLI runner for the settlement-balance test suite.
 *
 *   npm run test:settlement
 *
 * Runs every fixture against an in-memory SQLite database (no dev server
 * needed) and prints a per-case pass/fail report. Exits non-zero if any
 * case fails.
 */
import { runSettlementTests } from "../src/lib/test-data/run-settlement-tests";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const suite = runSettlementTests();

console.log(`\n${BOLD}Settlement-balance tests${RESET} ${DIM}(${suite.total} cases)${RESET}\n`);

for (const c of suite.cases) {
  const mark = c.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`${mark}  ${BOLD}${c.name}${RESET} ${DIM}— ${c.description}${RESET}`);

  const balances = c.balances
    .map((b) => `${b.friendId}: ${b.actual.toFixed(2)} (expected ${b.expected.toFixed(2)})`)
    .join("  ") || "(no friends)";
  console.log(`      ${DIM}balances:${RESET} ${balances}`);

  for (const check of c.checks) {
    if (!check.passed) {
      console.log(`      ${RED}✗ ${check.name}${RESET}${check.detail ? ` — ${check.detail}` : ""}`);
    }
  }
  console.log();
}

const summaryColor = suite.failed === 0 ? GREEN : RED;
console.log(
  `${summaryColor}${BOLD}${suite.passed}/${suite.total} passed${RESET}` +
    (suite.failed > 0 ? `  ${RED}(${suite.failed} failed)${RESET}` : "") +
    "\n"
);

process.exit(suite.failed === 0 ? 0 : 1);
