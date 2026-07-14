/**
 * CLI runner for the receipt-allocation test suite.
 *
 *   npm run test:allocation
 *
 * Runs every fixture in-memory (no database, no dev server, no LLM) and prints
 * a per-case pass/fail report. Exits non-zero if any case fails, so it can gate
 * CI or a pre-commit hook.
 */
import { runAllocationTests } from "../src/lib/test-data/run-allocation-tests";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const suite = runAllocationTests();

console.log(`\n${BOLD}Receipt-allocation tests${RESET} ${DIM}(${suite.total} cases)${RESET}\n`);

for (const c of suite.cases) {
  const mark = c.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`${mark}  ${BOLD}${c.name}${RESET} ${DIM}— ${c.description}${RESET}`);

  const totals =
    Object.entries(c.totals)
      .map(([uid, amt]) => `${uid}:$${amt.toFixed(2)}`)
      .join("  ") || "(nothing assigned)";
  console.log(`      ${DIM}totals:${RESET} ${totals}`);

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
