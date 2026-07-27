/**
 * fetch() wrapper that reconstructs the client → server latency breakdown.
 *
 * The instrumented API routes return their phase timings in the response
 * body as `_timing` (see src/lib/server-timing.ts — the Server-Timing
 * header is stripped by Vercel's proxy, the body isn't). Pairing
 * `_timing.total` (in-function time) with the browser's resource timing
 * (`responseStart − requestStart` = TTFB) backs out the network segment:
 *
 *   network = ttfb − server total  →  pipe + Vercel queue/cold start
 *
 * That's the number that's large on staging (syd1 function ↔ Mumbai DB is
 * already inside `total`; the pipe is browser ↔ syd1) and small on prod.
 *
 * Logging is gated behind test mode (`NEXT_PUBLIC_DEBUG_UI=true`), so this
 * is a drop-in fetch replacement that's silent in ordinary use.
 */
import { DEBUG_UI } from "./debug-config";

interface TimedBody {
  _timing?: Record<string, number>;
}

export async function timedFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json: T & TimedBody = await res.json();

  if (DEBUG_UI && typeof performance !== "undefined") {
    // Latest resource entry for this URL (fetches are recorded by full URL).
    const entry = performance
      .getEntriesByType("resource")
      .filter((e) => e.name.endsWith(url))
      .at(-1) as PerformanceResourceTiming | undefined;
    const ttfb = entry ? +(entry.responseStart - entry.requestStart).toFixed(1) : null;
    const serverTotal = json._timing?.total ?? null;

    console.table({
      url,
      ...json._timing, // server phases: auth, db, … , total
      ttfb, // browser → first byte
      network:
        ttfb != null && serverTotal != null ? +(ttfb - serverTotal).toFixed(1) : null,
    });
  }
  return json;
}
