/**
 * Server-Timing instrumentation for API routes.
 *
 * Wrap each phase of a request (auth, db, …) with `time()`, then attach
 * `header()` to the response. Browser DevTools renders the breakdown natively
 * (Network → select request → Timing tab), so per-phase latency is visible on
 * every deployed request with no third-party service.
 *
 *   const t = createTimer();
 *   const me = await t.time("auth", () => getCurrentUser());
 *   const data = await t.time("db", () => getBalance(me.id));
 *   return NextResponse.json({ ... }, { headers: t.headers() });
 *
 * Overhead is a couple of performance.now() calls and one small header —
 * safe to leave on in production. The header only exposes phase durations,
 * not query text or data.
 */
export interface ServerTimer {
  /** Run fn and record its wall time under `name`. */
  time<T>(name: string, fn: () => Promise<T>): Promise<T>;
  /** `{ "Server-Timing": "auth;dur=12.3, db;dur=45.6, total;dur=60.1" }` */
  headers(): Record<string, string>;
}

export function createTimer(): ServerTimer {
  const started = performance.now();
  const marks: { name: string; dur: number }[] = [];

  return {
    async time<T>(name: string, fn: () => Promise<T>): Promise<T> {
      const start = performance.now();
      try {
        return await fn();
      } finally {
        marks.push({ name, dur: performance.now() - start });
      }
    },
    headers() {
      const parts = marks.map((m) => `${m.name};dur=${m.dur.toFixed(1)}`);
      parts.push(`total;dur=${(performance.now() - started).toFixed(1)}`);
      return { "Server-Timing": parts.join(", ") };
    },
  };
}
