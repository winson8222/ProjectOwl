/**
 * CLI runner for the debt-simplification test suite.
 *
 *   npm run test:simplify
 *
 * Runs every fixture in-memory (no database, no dev server) and prints a
 * per-case pass/fail report. Exits non-zero if any case fails, so it can gate
 * CI or a pre-commit hook.
 */
import { runSimplifyTests } from "../src/lib/test-data/run-simplify-tests";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const suite = runSimplifyTests();

console.log(`\n${BOLD}Debt-simplification tests${RESET} ${DIM}(${suite.total} cases)${RESET}\n`);

for (const c of suite.cases) {
  const mark = c.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`${mark}  ${BOLD}${c.name}${RESET} ${DIM}— ${c.description}${RESET}`);

  const balances = c.netBalances
    .map((b) => `${b.userId}:${b.amount > 0 ? "+" : ""}${b.amount.toFixed(2)}`)
    .join("  ") || "(all settled)";
  console.log(`      ${DIM}net:${RESET} ${balances}`);

  const plan = c.transfers
    .map((t) => `${t.from}→${t.to} $${t.amount.toFixed(2)}`)
    .join("   ") || "(no payments needed)";
  console.log(`      ${DIM}plan (${c.transferCount}):${RESET} ${plan}`);

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
