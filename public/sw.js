// App-shell + data service worker.
//
// Shell (HTML doc, JS/CSS, icons): cache-first, populated opportunistically
// as the app is used, so the app can still open with no network.
//
// /api/* GET responses: network-first, falling back to the last cached
// response when offline — "last synced" data, never silently stale beyond
// that. Writes (non-GET) and cross-origin requests (Supabase, Gemini) are
// never intercepted.
//
// CACHE_VERSION comes from this script's own registration URL (?v=<sha>),
// which AppShell sets from the build's commit SHA.
//
// It used to be a hand-bumped constant, and in practice it never got bumped.
// Cleanup on activate only deletes caches whose NAME differs from the current
// one, so a version that never changes means cleanup never runs: every deploy
// added a new set of hashed chunks and removed none, and Cache Storage grew
// without bound until the browser evicted the whole origin.
//
// Reading it from the URL keeps this file free of build tooling — public/ is
// served verbatim, so nothing can inline a value into it. The literal below
// is only a fallback for a registration that passes no ?v=.
const CACHE_VERSION =
  new URLSearchParams(self.location.search).get("v") || "v2";
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;

// Build output (/_next/static/**) is deliberately NOT versioned with the two
// above. Those URLs are content-hashed, so an entry can never be stale — a
// changed file is a different URL. Rotating them per deploy is not just
// pointless, it breaks tabs that are still running the previous build: the
// cache name changes, every chunk that build cached is orphaned, and the
// request falls through to a network that no longer serves those URLs.
//
// Instead this cache is shared across deploys and bounded by entry count,
// pruned oldest-first on activate. Cache Storage preserves insertion order,
// so cache.keys() comes back oldest-first.
const ASSET_CACHE = "assets";
const ASSET_CACHE_LIMIT = 300;

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
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key !== SHELL_CACHE && key !== DATA_CACHE && key !== ASSET_CACHE
          )
          .map((key) => caches.delete(key))
      );
      await pruneAssetCache();
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

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigateHandler(request));
    return;
  }

  event.respondWith(cacheFirst(request, SHELL_CACHE));
});

} // end production-only block

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline, no cached data for " + request.url);
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    // Rejecting here is not a soft failure: a rejected respondWith() becomes a
    // network error for the request, so one unreachable chunk blanks a running
    // app. Check every cache, not just this one, before giving up — an asset
    // from a superseded deploy can still be sitting in another version's cache.
    const stale = await caches.match(request);
    if (stale) return stale;
    throw err;
  }
}

async function pruneAssetCache() {
  const cache = await caches.open(ASSET_CACHE);
  const keys = await cache.keys();
  const excess = keys.length - ASSET_CACHE_LIMIT;
  if (excess <= 0) return;
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}

async function navigateHandler(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = (await cache.match(request)) || (await cache.match("/"));
    if (cached) return cached;
    throw new Error("offline, no cached shell for " + request.url);
  }
}
