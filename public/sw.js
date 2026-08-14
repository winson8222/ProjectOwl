// Offline-fallback service worker.
//
// One rule, for everything: go to the network, and read from the cache only
// when the network actually fails. The cache is written on every success, so
// there's something to fall back to — it is never preferred while online.
//
// This replaced a cache-first shell. Cache-first cost more than it bought:
//
//   * It bought almost nothing. Next serves /_next/static/** with
//     `max-age=31536000, immutable`, so the browser's own HTTP cache already
//     holds those for a year. A fetch() from here goes through that cache, so
//     "network-first" on a build asset returns without touching the network
//     anyway. The worker was duplicating the HTTP cache.
//   * It cost a whole class of blank-page bugs. Anything cache-first can
//     serve content that no longer matches the running build, and every
//     failure it hits lands on the user as a dead app rather than a slow one.
//
// Network-first cannot serve a stale asset while online, so cache naming no
// longer has to encode the build. The caches are fixed names, shared across
// deploys and bounded by entry count. That is deliberate: versioned names
// meant every deploy started with an empty cache, i.e. no offline support at
// all until the user next went online — the opposite of the point.
//
// Writes (non-GET) and cross-origin requests (Supabase, Gemini) are never
// intercepted.
//
// CACHE_VERSION is still read from this script's registration URL (?v=<sha>,
// set by AppShell from the build SHA). It no longer names any cache; its only
// job is making the script URL change per deploy so the browser installs the
// new worker at all — sw.js is otherwise byte-identical between builds and
// would never update.
const CACHE_VERSION =
  new URLSearchParams(self.location.search).get("v") || "v2";

const SHELL_CACHE = "shell";
const DATA_CACHE = "data";
const ASSET_CACHE = "assets";

// Bounds on each cache, pruned oldest-first on activate. Cache Storage
// preserves insertion order, so cache.keys() comes back oldest-first.
const CACHE_LIMITS = {
  [SHELL_CACHE]: 100,
  [DATA_CACHE]: 100,
  [ASSET_CACHE]: 300,
};

const SHELL_URLS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

// ── Local development kill switch ─────────────────────────────────────
// A worker registered against http://localhost:3000 outlives the process
// that installed it, so it keeps serving an earlier session's JS chunks to
// every later `npm run dev` — indistinguishable from "my code didn't apply".
// Skipping registration on the client can't help a browser that already has
// a worker installed, because the stale worker is what's serving the client
// code. The browser DOES re-fetch this file on navigation, so having the
// worker uninstall itself is the only fix that reaches those browsers.
const IS_LOCAL =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1" ||
  self.location.hostname.endsWith(".local") ||
  /^(192\.168|10)\./.test(self.location.hostname);

if (IS_LOCAL) {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        await self.registration.unregister();
        // Reload open tabs so they pick up un-intercepted assets immediately.
        const windows = await self.clients.matchAll({ type: "window" });
        windows.forEach((c) => c.navigate(c.url));
      })()
    );
  });
  // No fetch handler on localhost: every request goes straight to the dev
  // server. Everything below is production-only.
} else {

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);

      // Deliberately not cache.addAll(). addAll() rejects the whole batch if
      // any single response is non-ok, and a rejected install means the new
      // worker never activates — the old one keeps serving, and a deployed fix
      // silently does nothing. `/` and `/manifest.json` are
      // max-age=0, must-revalidate, so a conditional request answers 304, which
      // is non-ok and would take the install down with it.
      //
      // `cache: "reload"` skips the HTTP cache on the way out, so these come
      // back 200 with a body rather than 304 with none. Precaching is
      // best-effort: one missing icon must not cost us the whole worker.
      await Promise.all(
        SHELL_URLS.map(async (url) => {
          try {
            const response = await fetch(url, {
              cache: "reload",
              credentials: "same-origin",
            });
            if (response.ok) await cache.put(url, response);
          } catch {
            /* best effort */
          }
        })
      );
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      // Drops the per-deploy caches earlier versions created (shell-<sha>,
      // data-<sha>, ...). Without this they'd sit there forever now that
      // nothing writes to them.
      await Promise.all(
        keys
          .filter((key) => !(key in CACHE_LIMITS))
          .map((key) => caches.delete(key))
      );

      await Promise.all(
        Object.entries(CACHE_LIMITS).map(([name, limit]) => prune(name, limit))
      );
    })()
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Build assets are keyed on the path alone — see assetKey() — and are the
  // one case where a cached copy is provably interchangeable with the
  // server's, so a 404 from a superseded deploy falls back instead of killing
  // the page.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      networkFirst(request, ASSET_CACHE, { key: assetKey(request), immutable: true })
    );
    return;
  }

  event.respondWith(networkFirst(request, SHELL_CACHE));
});

} // end production-only block

/**
 * The only fetch strategy in this worker.
 *
 * Network first, always. The cached copy exists solely for the case where the
 * network throws, and is never consulted otherwise — so the worker can't serve
 * anything that disagrees with the running build while the user is online.
 *
 * `key` lets a caller store and look up under something other than the request
 * itself (build assets normalise their query away — see assetKey).
 *
 * A rejected respondWith() becomes a network error for the request, which for
 * a script tag means a blank app rather than a slow one. So every fallback is
 * exhausted before rethrowing, and navigations fall back to the app shell.
 */
async function networkFirst(request, cacheName, options = {}) {
  const { key = request, immutable = false } = options;
  const cache = await caches.open(cacheName);

  try {
    let response = await fetch(request);

    // A 304 carries NO BODY. Normally the browser never shows one to the page:
    // it merges the 304 with its own HTTP cache entry and synthesises a 200.
    // A response handed back from respondWith() skips that merge entirely, so
    // returning a 304 delivers an empty document or an empty script — a blank
    // page, with nothing in the console to explain it.
    //
    // This is the normal answer, not an edge case: `/` and `/api/*` are served
    // max-age=0, must-revalidate, so every load after the first sends a
    // conditional request and gets 304 back.
    if (response.status === 304) {
      const cached = await cache.match(key);
      if (cached) return cached;

      // 304 with nothing cached to pair it against — the browser revalidated
      // off its own HTTP cache, which we can't read. Ask again unconditionally
      // so there's a body to return.
      response = await fetch(request.url, {
        cache: "reload",
        credentials: "same-origin",
      });
    }

    if (response.ok) {
      cache.put(key, response.clone());
      return response;
    }

    // A 404 is a response, not an error, so it sails past the catch below and
    // reaches the page — and a 404'd <script> kills the app just as dead as a
    // failed one. That matters here because a deploy DELETES the previous
    // build's chunks: a hash whose content changed is simply gone, verified
    // against staging. A tab open across a deploy asks for files that no
    // longer exist.
    //
    // Only safe to absorb for `immutable` callers. A content-hashed path means
    // a cached copy is byte-identical to whatever the server would have sent,
    // so preferring it can't show anything stale. Everywhere else a 404 is
    // real information the app needs.
    if (immutable) {
      const cached = await cache.match(key);
      if (cached) return cached;
    }

    return response;
  } catch (err) {
    const cached = await cache.match(key);
    if (cached) return cached;

    // Any navigation we've never cached still gets the shell, so an offline
    // deep link opens the app instead of the browser's error page.
    if (request.mode === "navigate") {
      const shell = await (await caches.open(SHELL_CACHE)).match("/");
      if (shell) return shell;
    }

    throw err;
  }
}

/**
 * Cache key for a build asset: the URL with its query string removed.
 *
 * Vercel appends `?dpl=<deployment id>` to every /_next/static URL, and that
 * value changes on every deploy while the bytes behind it do not — the path
 * already carries a content hash, which is what actually identifies the file.
 *
 * Matching on the full URL therefore misses on every asset after a deploy even
 * though a byte-identical copy is already cached, and re-stores it under the
 * new query: zero reuse, and the cache fills with duplicates of the same file
 * until pruning evicts entries that were still useful. Normalising the query
 * away — for lookup AND for storage — is what makes this cache survive a
 * deploy at all.
 *
 * Safe precisely because the path is content-hashed: two URLs that differ only
 * in the query are the same file by construction.
 */
function assetKey(request) {
  const url = new URL(request.url);
  url.search = "";
  return url.href;
}

async function prune(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = keys.length - limit;
  if (excess <= 0) return;
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}
