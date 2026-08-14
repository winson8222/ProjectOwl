// Service worker: DISABLED — this file exists only to uninstall itself.
//
// Deleting this file, or just dropping the register() call, would NOT have
// disabled anything: a worker that is already installed in someone's browser
// stays installed and keeps intercepting every request forever. The only thing
// that reaches those browsers is a new version of this script, because the
// browser re-fetches it when checking an existing registration. So the way to
// turn a service worker off is to ship one that removes itself.
//
// Why it's off: a sequence of caching strategies each fixed the previous
// failure and introduced another — a blank app after every deploy, then assets
// orphaned by Vercel's per-deploy ?dpl query, then 404s from superseded builds
// reaching the page as fatal empty scripts, then requests that never settled
// and left the app loading forever. Each fix passed its tests and failed in a
// real browser. The worker was buying offline support and, for online users,
// nothing else: Next serves /_next/static/** with `max-age=31536000,
// immutable`, so the browser's own HTTP cache already covers the speed case.
// That is a bad trade for a feature that can take the whole app down.
//
// To bring caching back, do it with a real browser in the loop — a headless
// test that drives two consecutive deploys with a tab held open — not a
// node:vm harness. Every failure in that sequence was invisible to the
// harness and obvious in the browser.
//
// Keep serving this file. Removing it makes the request 404, the browser keeps
// the last working registration, and the old worker lives on.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Order matters: drop the caches while we still control them, then
      // remove the registration.
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));

      await self.registration.unregister();

      // Tabs currently controlled by the old worker keep being served by it
      // until they navigate. Reloading them is what actually ends the outage
      // for anyone sitting on a broken page.
      //
      // This cannot loop: AppShell no longer registers anything, so once the
      // registration is gone nothing installs another worker.
      const windows = await self.clients.matchAll({ type: "window" });
      windows.forEach((client) => client.navigate(client.url));
    })()
  );
});

// Deliberately no "fetch" listener. A worker with no fetch handler doesn't
// intercept anything — every request goes straight to the network and the
// browser's own HTTP cache, exactly as if no worker existed.
