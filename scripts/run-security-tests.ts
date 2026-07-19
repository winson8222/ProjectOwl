/**
 * CLI runner for the security-hardening test suite.
 *
 *   npm run test:security
 *
 * Runs the pure validators behind the security changes (money validation,
 * settlement-amount validation, limit clamping, debug-endpoint gating) against
 * their fixtures. No dev server or database needed. Exits non-zero on any
 * failure.
 */
import { runSecurityTests } from "../src/lib/test-data/run-security-tests";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const suite = runSecurityTests();

console.log(`\n${BOLD}Security-hardening tests${RESET} ${DIM}(${suite.total} cases)${RESET}\n`);

let currentGroup = "";
for (const c of suite.cases) {
  if (c.group !== currentGroup) {
    currentGroup = c.group;
    console.log(`${DIM}── ${currentGroup} ──${RESET}`);
  }
  const mark = c.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`  ${mark}  ${BOLD}${c.name}${RESET} ${DIM}— ${c.description}${RESET}`);
  if (!c.passed) {
    console.log(`        ${RED}✗ ${c.detail ?? ""}${RESET}`);
  }
}

const summaryColor = suite.failed === 0 ? GREEN : RED;
console.log(
  `\n${summaryColor}${BOLD}${suite.passed}/${suite.total} passed${RESET}` +
    (suite.failed > 0 ? `  ${RED}(${suite.failed} failed)${RESET}` : "") +
    "\n"
);

process.exit(suite.failed === 0 ? 0 : 1);
