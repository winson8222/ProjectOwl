/**
 * CLI runner for the service-worker kill-switch checks.
 *
 *   npm run test:sw
 *
 * The worker is disabled (see public/sw.js). What used to live here was a
 * large suite covering cache strategies; all of it tested behaviour that no
 * longer exists, and — worth remembering — it went green against workers that
 * were broken in a real browser more than once. Keeping it would have been
 * worse than deleting it.
 *
 * What's left asserts the only three things that now matter: the worker
 * intercepts nothing, it clears Cache Storage, and it removes its own
 * registration.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const SW_PATH = path.join(process.cwd(), "public", "sw.js");

type Check = { name: string; passed: boolean; detail?: string };

class FakeCacheStorage {
  store = new Map<string, unknown>();
  async keys() {
    return [...this.store.keys()];
  }
  async delete(name: string) {
    return this.store.delete(name);
  }
}

function run(source: string) {
  const listeners: Record<string, ((event: unknown) => void)[]> = {};
  const pending: Promise<unknown>[] = [];

  const caches = new FakeCacheStorage();
  // Pretend a previous build left several caches behind.
  for (const name of ["shell", "data", "assets", "shell-abc123", "data-abc123"]) {
    caches.store.set(name, {});
  }

  let unregistered = false;
  const navigated: string[] = [];

  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      (listeners[type] ||= []).push(fn);
    },
    skipWaiting: () => {},
    registration: {
      unregister: async () => {
        unregistered = true;
        return true;
      },
    },
    clients: {
      claim: async () => {},
      matchAll: async () => [
        { url: "https://projectowl.app/", navigate: async (u: string) => void navigated.push(u) },
        { url: "https://projectowl.app/groups", navigate: async (u: string) => void navigated.push(u) },
      ],
    },
    location: { href: "https://projectowl.app/sw.js", search: "", hostname: "projectowl.app" },
  };

  vm.runInContext(
    source,
    vm.createContext({ self, caches, console, URL, URLSearchParams, Response, Promise, Error, TypeError, setTimeout, clearTimeout }),
    { filename: "sw.js" }
  );

  return {
    listeners,
    caches,
    get unregistered() {
      return unregistered;
    },
    navigated,
    async activate() {
      for (const fn of listeners.activate || []) {
        fn({ waitUntil: (p: Promise<unknown>) => pending.push(p) });
      }
      await Promise.all(pending.splice(0));
    },
  };
}

async function main() {
  const source = readFileSync(SW_PATH, "utf8");
  const sw = run(source);

  const checks: Check[] = [];

  checks.push({
    name: "registers no fetch handler (intercepts nothing)",
    passed: !sw.listeners.fetch,
    detail: sw.listeners.fetch ? `${sw.listeners.fetch.length} fetch listener(s)` : "none",
  });

  const before = (await sw.caches.keys()).length;
  await sw.activate();
  const after = await sw.caches.keys();

  checks.push({
    name: "deletes every cache on activate",
    passed: after.length === 0,
    detail: `${before} -> ${after.length}${after.length ? " (" + after.join(", ") + ")" : ""}`,
  });

  checks.push({
    name: "unregisters itself",
    passed: sw.unregistered,
    detail: sw.unregistered ? "registration.unregister() called" : "NOT called",
  });

  checks.push({
    name: "reloads controlled tabs so they leave the old worker",
    passed: sw.navigated.length === 2,
    detail: sw.navigated.join(", ") || "none",
  });

  const GREEN = "\x1b[32m";
  const RED = "\x1b[31m";
  const DIM = "\x1b[2m";
  const BOLD = "\x1b[1m";
  const RESET = "\x1b[0m";

  console.log(`\n${BOLD}Service worker — kill switch${RESET} ${DIM}(${checks.length} checks)${RESET}\n`);
  let failed = 0;
  for (const c of checks) {
    if (!c.passed) failed++;
    console.log(
      `${c.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`}  ${c.name}` +
        (c.detail ? ` ${DIM}— ${c.detail}${RESET}` : "")
    );
  }

  const color = failed === 0 ? GREEN : RED;
  console.log(
    `\n${color}${BOLD}${checks.length - failed}/${checks.length} passed${RESET}` +
      (failed ? `  ${RED}(${failed} failed)${RESET}` : "") +
      "\n"
  );
  process.exit(failed === 0 ? 0 : 1);
}

main();
