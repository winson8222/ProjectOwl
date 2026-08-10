"use client";

/**
 * Tracks whether the most recent route change was a browser "back"
 * (popstate, e.g. router.back()) rather than a forward push, so a page can
 * mirror its entrance animation instead of always sliding in from the right.
 */
let wasPopNavigation = false;

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    wasPopNavigation = true;
  });
}

/** Reads and clears the back-navigation flag. Call once per mount. */
export function consumeBackNavigation(): boolean {
  const wasBack = wasPopNavigation;
  wasPopNavigation = false;
  return wasBack;
}
