/**
 * CLI runner for the service-worker caching test suite.
 *
 *   npm run test:sw
 *
 * Loads the real `public/sw.js` into a VM with a fake Cache Storage and a
 * scripted network, then replays deploy scenarios against it. No browser, no
 * dev server, no database — same spirit as the simplify/allocation suites,
 * but it can't run in the browser at /debug because it needs node:vm to
 * instantiate the worker.
 *
 * The scenario that matters: a new deploy lands while a tab is still running
 * the previous build. That tab's HTML references the previous build's
 * content-hashed chunks, and those URLs are gone from the server. If the
 * worker can't produce them from cache, `respondWith` rejects, the browser
 * turns that into a network error for the <script>, and the app never boots.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ORIGIN = "https://projectowl.app";
const SW_PATH = path.join(process.cwd(), "public", "sw.js");

const SHELL_URLS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

const CHUNK_A = "/_next/static/chunks/app-AAAA.js";
const CHUNK_B = "/_next/static/chunks/app-BBBB.js";
const ASSET_CACHE_LIMIT = 300;

/**
 * Vercel stamps every /_next/static URL with the deployment id, so the same
 * file is requested under a different query on every deploy. Scenarios below
 * append it the way production does — without it these tests pass against a
 * worker that has no cross-deploy reuse at all.
 */
const dpl = (path: string, deployment: string) => `${path}?dpl=dpl_${deployment}`;

type Req = { url: string; method: string; mode?: string };
type FetchInit = { cache?: string; credentials?: string };
type Net = (target: Req | string, init?: FetchInit) => Promise<Response>;

const absolute = (target: Req | string) =>
  typeof target === "string" ? new URL(target, ORIGIN).href : target.url;

const req = (url: string, extra: Partial<Req> = {}): Req => ({
  url: new URL(url, ORIGIN).href,
  method: "GET",
  ...extra,
});

// ── fake Cache Storage ────────────────────────────────────────────────
// Map preserves insertion order, which is also what the Cache Storage spec
// guarantees for keys() — the oldest-first pruning in sw.js relies on it.
class FakeCache {
  map = new Map<string, Response>();
  constructor(public net: Net) {}
  async match(target: Req | string) {
    return this.map.get(absolute(target));
  }
  async put(target: Req | string, res: Response) {
    this.map.set(absolute(target), res);
  }
  async keys() {
    return [...this.map.keys()].map((url) => ({ url }));
  }
  async delete(target: Req | string) {
    return this.map.delete(absolute(target));
  }
  async addAll(urls: string[]) {
    for (const u of urls) {
      const res = await this.net(absolute(u));
      if (!res.ok) throw new TypeError("addAll: bad response for " + u);
      this.map.set(absolute(u), res);
    }
  }
}

class FakeCacheStorage {
  store = new Map<string, FakeCache>();
  constructor(public net: Net) {}
  async open(name: string) {
    let cache = this.store.get(name);
    if (!cache) {
      cache = new FakeCache(this.net);
      this.store.set(name, cache);
    }
    return cache;
  }
  async keys() {
    return [...this.store.keys()];
  }
  async delete(name: string) {
    return this.store.delete(name);
  }
  /** CacheStorage.match() searches every cache, in order. */
  async match(target: Req | string) {
    for (const cache of this.store.values()) {
      const hit = await cache.match(target);
      if (hit) return hit;
    }
    return undefined;
  }
  /** Point every cache at a new network (i.e. a deploy landed). */
  repoint(net: Net) {
    this.net = net;
    for (const cache of this.store.values()) cache.net = net;
  }
}

/**
 * A server serving exactly one build: `liveChunk` exists, older ones don't.
 * Matches on pathname only — the ?dpl query is ignored by the real CDN too
 * (verified: any dpl value, including a bogus one, returns the same bytes).
 */
function makeNetwork(liveChunk: string, missing: "throw" | "404"): Net {
  return async (target) => {
    const { pathname } = new URL(absolute(target));
    if (SHELL_URLS.includes(pathname)) return new Response("shell", { status: 200 });
    if (pathname === liveChunk) return new Response("chunk", { status: 200 });
    if (missing === "throw") throw new TypeError("Failed to fetch");
    return new Response("Not Found", { status: 404 });
  };
}

type FetchOutcome =
  | { kind: "response"; status: number; body: string }
  | { kind: "passthrough" }
  | { kind: "throw"; name: string; message: string };

function loadWorker(opts: {
  source: string;
  version: string;
  cacheStorage: FakeCacheStorage;
  net: Net;
}) {
  const listeners: Record<string, ((event: unknown) => void)[]> = {};
  const pending: Promise<unknown>[] = [];

  const self = {
    // Short network timeout so the hang case doesn't cost the suite 10s.
    SW_NETWORK_TIMEOUT_MS: 150,
    location: {
      href: `${ORIGIN}/sw.js?v=${opts.version}`,
      search: `?v=${opts.version}`,
      hostname: "projectowl.app",
      origin: ORIGIN,
    },
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      (listeners[type] ||= []).push(fn);
    },
    skipWaiting: () => {},
    clients: { claim: async () => {}, matchAll: async () => [] },
    registration: { unregister: async () => {} },
  };

  const ctx = vm.createContext({
    self,
    caches: opts.cacheStorage,
    fetch: opts.net,
    console,
    URL,
    URLSearchParams,
    Response,
    Promise,
    Error,
    TypeError,
    // Without these the worker's timeout throws ReferenceError, the race
    // rejects instantly, and the timeout path silently never runs.
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(opts.source, ctx, { filename: "sw.js" });

  const dispatch = async (type: string, event: unknown) => {
    for (const fn of listeners[type] || []) fn(event);
    await Promise.all(pending.splice(0));
  };

  return {
    install: () => dispatch("install", { waitUntil: (p: Promise<unknown>) => pending.push(p) }),
    activate: () => dispatch("activate", { waitUntil: (p: Promise<unknown>) => pending.push(p) }),
    /** Mirrors the browser: whatever respondWith() gets is what the page sees. */
    async handleFetch(request: Req): Promise<FetchOutcome> {
      let responded: Promise<Response> | undefined;
      for (const fn of listeners.fetch || []) {
        fn({ request, respondWith: (p: Promise<Response>) => { responded = p; } });
      }
      if (!responded) return { kind: "passthrough" };
      try {
        const response = await responded;
        return {
          kind: "response",
          status: response.status,
          body: await response.clone().text(),
        };
      } catch (err) {
        const e = err as Error;
        return { kind: "throw", name: e.constructor.name, message: e.message };
      }
    },
  };
}

// ── cases ─────────────────────────────────────────────────────────────
type Check = { name: string; passed: boolean; detail?: string };
type Case = { name: string; description: string; checks: Check[]; notes: string[] };

async function deployCase(source: string, missing: "throw" | "404"): Promise<Case> {
  const checks: Check[] = [];
  const notes: string[] = [];

  // Deploy A: worker installs, a tab loads and caches build A's chunk.
  const netA = makeNetwork(CHUNK_A, missing);
  const storage = new FakeCacheStorage(netA);
  const swA = loadWorker({ source, version: "aaaaaaaa", cacheStorage: storage, net: netA });
  await swA.install();
  await swA.activate();
  await swA.handleFetch(req(dpl(CHUNK_A, "aaaaaaaa")));
  notes.push(`caches after deploy A: ${(await storage.keys()).join(", ")}`);

  // Deploy B lands and takes over the still-open tab.
  const netB = makeNetwork(CHUNK_B, missing);
  storage.repoint(netB);
  const swB = loadWorker({ source, version: "bbbbbbbb", cacheStorage: storage, net: netB });
  await swB.install();
  await swB.activate();
  notes.push(`caches after deploy B: ${(await storage.keys()).join(", ")}`);

  // The old tab asks for the chunk its HTML references — same path, but
  // stamped with deploy A's id, which is now stale.
  const outcome = await swB.handleFetch(req(dpl(CHUNK_A, "aaaaaaaa")));
  notes.push(`old tab requesting ${CHUNK_A}?dpl=A: ${JSON.stringify(outcome)}`);

  checks.push({
    name: "asset request does not reject out of respondWith",
    passed: outcome.kind !== "throw",
    detail: outcome.kind === "throw" ? `${outcome.name}: ${outcome.message}` : undefined,
  });
  checks.push({
    name: "old tab still gets a usable 200 for its chunk",
    passed: outcome.kind === "response" && outcome.status === 200,
    detail: outcome.kind === "response" ? `status ${outcome.status}` : outcome.kind,
  });

  const names = await storage.keys();
  checks.push({
    name: "caches are not per-deploy",
    passed: !names.some((n) => /-(aaaaaaaa|bbbbbbbb)$/.test(n)),
    detail: names.join(", "),
  });
  checks.push({
    name: "shared asset cache survives the deploy",
    passed: names.includes("assets"),
    detail: names.join(", "),
  });

  return {
    name: `deploy-while-tab-open (${missing === "throw" ? "network error" : "404"})`,
    description:
      missing === "throw"
        ? "superseded chunk fails at the network level"
        : "superseded chunk returns 404",
    checks,
    notes,
  };
}

/**
 * The core rule: while the network works, the cache is never consulted.
 *
 * A cached copy that disagrees with the running build is exactly what used to
 * blank the app, so being online must always mean serving what the server
 * says — the cache exists only for the offline path.
 */
async function networkWinsCase(source: string): Promise<Case> {
  const checks: Check[] = [];
  const notes: string[] = [];

  // Prime every cache from a server that answers "old".
  const oldNet: Net = async () => new Response("old", { status: 200 });
  const storage = new FakeCacheStorage(oldNet);
  const sw = loadWorker({ source, version: "v1", cacheStorage: storage, net: oldNet });
  await sw.install();
  await sw.activate();
  await sw.handleFetch(req(CHUNK_A));
  await sw.handleFetch(req("/api/groups"));
  await sw.handleFetch(req("/", { mode: "navigate" }));

  // Now the server answers "new" while those stale copies are still cached.
  const newNet: Net = async () => new Response("new", { status: 200 });
  storage.repoint(newNet);
  const sw2 = loadWorker({ source, version: "v1", cacheStorage: storage, net: newNet });

  for (const [label, request] of [
    ["build asset", req(CHUNK_A)],
    ["api response", req("/api/groups")],
    ["navigation", req("/", { mode: "navigate" })],
  ] as [string, Req][]) {
    const outcome = await sw2.handleFetch(request);
    const body = outcome.kind === "response" ? outcome.body : outcome.kind;
    notes.push(`${label} while online: served "${body}"`);
    checks.push({
      name: `${label}: network wins over the cached copy`,
      passed: body === "new",
      detail: `got "${body}"`,
    });
  }

  // ...and the stale copy is still there for when the network dies.
  const dead: Net = async () => {
    throw new TypeError("Failed to fetch");
  };
  storage.repoint(dead);
  const sw3 = loadWorker({ source, version: "v1", cacheStorage: storage, net: dead });
  const offline = await sw3.handleFetch(req(CHUNK_A));
  notes.push(`build asset once offline: ${JSON.stringify(offline)}`);
  checks.push({
    name: "offline still falls back to the cache",
    passed: offline.kind === "response" && offline.status === 200,
    detail: offline.kind === "throw" ? `${offline.name}: ${offline.message}` : offline.kind,
  });

  return {
    name: "network-wins-while-online",
    description: "cache is an offline fallback, never a preference",
    checks,
    notes,
  };
}

/**
 * The deployment stamp must not defeat the cache. Same file, same content
 * hash, new ?dpl — it has to come from cache, not the network.
 */
async function deploymentStampCase(source: string): Promise<Case> {
  const checks: Check[] = [];
  const notes: string[] = [];

  // Deploy A caches the chunk under deploy A's stamp.
  const netA = makeNetwork(CHUNK_A, "throw");
  const storage = new FakeCacheStorage(netA);
  const swA = loadWorker({ source, version: "aaaaaaaa", cacheStorage: storage, net: netA });
  await swA.install();
  await swA.activate();
  await swA.handleFetch(req(dpl(CHUNK_A, "aaaaaaaa")));

  const assets = await storage.open("assets");
  notes.push(`asset keys after deploy A: ${(await assets.keys()).map((k) => k.url).join(", ")}`);

  // Deploy B ships the identical file — same content hash, new stamp. Take the
  // network away entirely, so only a cache hit can succeed.
  const dead: Net = async () => {
    throw new TypeError("Failed to fetch");
  };
  storage.repoint(dead);
  const swB = loadWorker({ source, version: "bbbbbbbb", cacheStorage: storage, net: dead });
  await swB.install().catch(() => {});
  await swB.activate();

  const outcome = await swB.handleFetch(req(dpl(CHUNK_A, "bbbbbbbb")));
  notes.push(`same file under deploy B's stamp: ${JSON.stringify(outcome)}`);

  checks.push({
    name: "a new ?dpl still hits the cached copy",
    passed: outcome.kind === "response" && outcome.status === 200,
    detail: outcome.kind === "throw" ? `${outcome.name}: ${outcome.message}` : outcome.kind,
  });

  // And it must not have stored a second copy of the same file.
  const keys = (await assets.keys()).map((k) => k.url);
  checks.push({
    name: "the stamp is not duplicated into a second cache entry",
    passed: keys.length === 1 && !keys[0].includes("?"),
    detail: keys.join(", ") || "(empty)",
  });

  return {
    name: "deployment-stamp",
    description: "Vercel's ?dpl changes every deploy; the bytes do not",
    checks,
    notes,
  };
}

/**
 * A 304 must never reach the page.
 *
 * `/` and `/api/*` are max-age=0, must-revalidate, so every load after the
 * first is a conditional request answered 304 — and a 304 has no body. The
 * browser normally merges it with its own HTTP cache; a response returned from
 * respondWith() skips that merge, so passing one through renders nothing.
 */
async function revalidationCase(source: string): Promise<Case> {
  const checks: Check[] = [];
  const notes: string[] = [];

  // Server behaves like Vercel: 304 to a conditional request, 200 with a body
  // when asked unconditionally (cache: "reload").
  let unconditionalCalls = 0;
  const revalidating: Net = async (_target, init) => {
    if (init?.cache === "reload") {
      unconditionalCalls++;
      return new Response("fresh document", { status: 200 });
    }
    // 304 is a null-body status — constructing it with "" throws.
    return new Response(null, { status: 304 });
  };

  const storage = new FakeCacheStorage(revalidating);
  const sw = loadWorker({ source, version: "v1", cacheStorage: storage, net: revalidating });
  await sw.install();
  await sw.activate();

  notes.push(`install fetched ${unconditionalCalls} URLs unconditionally`);
  checks.push({
    name: "install survives a 304 (worker actually activates)",
    passed: unconditionalCalls > 0,
    detail: `${unconditionalCalls} unconditional fetches`,
  });

  // Cold cache: a 304 with nothing to pair it against must be re-fetched.
  const cold = await sw.handleFetch(req("/", { mode: "navigate" }));
  notes.push(`navigation, nothing cached: ${JSON.stringify(cold)}`);
  checks.push({
    name: "304 with a cold cache is re-fetched, not passed through",
    passed: cold.kind === "response" && cold.status === 200 && cold.body.length > 0,
    detail: cold.kind === "response" ? `status ${cold.status}, body "${cold.body}"` : cold.kind,
  });

  // Warm cache: the 304 should resolve to the cached body.
  const warm = await sw.handleFetch(req("/", { mode: "navigate" }));
  notes.push(`navigation, warm cache: ${JSON.stringify(warm)}`);
  checks.push({
    name: "304 with a warm cache serves the cached body",
    passed: warm.kind === "response" && warm.status === 200 && warm.body.length > 0,
    detail: warm.kind === "response" ? `status ${warm.status}, body "${warm.body}"` : warm.kind,
  });

  // And an API GET, which revalidates the same way.
  const api = await sw.handleFetch(req("/api/groups"));
  notes.push(`api 304: ${JSON.stringify(api)}`);
  checks.push({
    name: "an API 304 never reaches the page either",
    passed: api.kind === "response" && api.status !== 304,
    detail: api.kind === "response" ? `status ${api.status}` : api.kind,
  });

  return {
    name: "revalidation-304",
    description: "must-revalidate means 304 is the normal answer, and it has no body",
    checks,
    notes,
  };
}

/**
 * A network that never answers must not hang the page.
 *
 * respondWith() takes a promise, and nothing bounds it. AppShell gates the
 * entire app on one fetch and flips `ready` in a `.finally()` — which never
 * runs if the promise stays pending — so a single hung request leaves an empty
 * page loading forever with nothing in the console.
 */
async function hangCase(source: string): Promise<Case> {
  const checks: Check[] = [];
  const notes: string[] = [];

  // Prime the caches from a working server.
  const alive: Net = async () => new Response("cached copy", { status: 200 });
  const storage = new FakeCacheStorage(alive);
  const warm = loadWorker({ source, version: "v1", cacheStorage: storage, net: alive });
  await warm.install();
  await warm.activate();
  await warm.handleFetch(req("/api/auth/me"));

  // Now the network accepts the request and simply never answers.
  const blackHole: Net = () => new Promise<Response>(() => {});
  storage.repoint(blackHole);
  const sw = loadWorker({ source, version: "v1", cacheStorage: storage, net: blackHole });

  const started = Date.now();
  const settled = await Promise.race([
    sw.handleFetch(req("/api/auth/me")).then((o) => o as FetchOutcome | "pending"),
    new Promise<"pending">((r) => setTimeout(() => r("pending"), 3000)),
  ]);
  const elapsed = Date.now() - started;

  notes.push(`hung request settled in ${elapsed}ms: ${JSON.stringify(settled)}`);
  checks.push({
    name: "a request the network never answers still settles",
    passed: settled !== "pending",
    detail: settled === "pending" ? "still pending after 3s" : `${elapsed}ms`,
  });
  checks.push({
    name: "and it falls back to the cached copy",
    passed:
      settled !== "pending" &&
      settled.kind === "response" &&
      settled.body === "cached copy",
    detail: settled === "pending" ? "n/a" : JSON.stringify(settled),
  });

  return {
    name: "hung-network",
    description: "nothing may leave respondWith() pending forever",
    checks,
    notes,
  };
}

async function pruneCase(source: string): Promise<Case> {
  const checks: Check[] = [];
  const notes: string[] = [];

  const net = makeNetwork(CHUNK_A, "404");
  const storage = new FakeCacheStorage(net);
  const sw = loadWorker({ source, version: "v1", cacheStorage: storage, net });
  await sw.install();

  const assets = await storage.open("assets");
  const total = ASSET_CACHE_LIMIT + 200;
  for (let i = 0; i < total; i++) {
    await assets.put(req(`/_next/static/chunks/c-${i}.js`), new Response("x", { status: 200 }));
  }

  await sw.activate();
  const survivors = (await assets.keys()).map((k) => k.url);
  notes.push(`asset cache entries: ${total} -> ${survivors.length}`);

  checks.push({
    name: "asset cache pruned to the cap",
    passed: survivors.length === ASSET_CACHE_LIMIT,
    detail: `got ${survivors.length}`,
  });
  checks.push({
    name: "pruning drops oldest entries, keeps newest",
    passed:
      survivors.at(-1)!.endsWith(`c-${total - 1}.js`) &&
      survivors[0].endsWith(`c-${total - ASSET_CACHE_LIMIT}.js`),
    detail: `${survivors[0]} .. ${survivors.at(-1)}`,
  });

  return {
    name: "asset-cache-bounded",
    description: "shared asset cache stays bounded across many deploys",
    checks,
    notes,
  };
}

// ── report ────────────────────────────────────────────────────────────
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

async function main() {
  const source = readFileSync(SW_PATH, "utf8");
  const cases = [
    await hangCase(source),
    await revalidationCase(source),
    await networkWinsCase(source),
    await deployCase(source, "throw"),
    await deployCase(source, "404"),
    await deploymentStampCase(source),
    await pruneCase(source),
  ];

  console.log(`\n${BOLD}Service-worker cache tests${RESET} ${DIM}(${cases.length} cases)${RESET}\n`);

  let failed = 0;
  for (const c of cases) {
    const ok = c.checks.every((check) => check.passed);
    if (!ok) failed++;
    console.log(`${ok ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`}  ${BOLD}${c.name}${RESET} ${DIM}— ${c.description}${RESET}`);
    for (const note of c.notes) console.log(`      ${DIM}${note}${RESET}`);
    for (const check of c.checks) {
      if (!check.passed) {
        console.log(`      ${RED}✗ ${check.name}${RESET}${check.detail ? ` — ${check.detail}` : ""}`);
      }
    }
    console.log();
  }

  const passed = cases.length - failed;
  const color = failed === 0 ? GREEN : RED;
  console.log(
    `${color}${BOLD}${passed}/${cases.length} passed${RESET}` +
      (failed > 0 ? `  ${RED}(${failed} failed)${RESET}` : "") +
      "\n"
  );

  process.exit(failed === 0 ? 0 : 1);
}

main();
