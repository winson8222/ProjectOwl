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
// Bump CACHE_VERSION when shell assets change meaningfully so stale caches
// get cleared on activate (no build-hash wiring yet — manual bump).
const CACHE_VERSION = "v2";
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;

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
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      )
    )
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
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
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
