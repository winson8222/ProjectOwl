"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary.
 *
 * Without this file a client-side render error unmounts the tree and React
 * renders nothing — the page goes blank with no message anywhere, and the
 * console entry is easy to miss on mobile where there is no console at all.
 * A whole day was lost to a "blank page" that was really an uncaught render
 * error wearing the same clothes as a caching bug.
 *
 * So this deliberately shows the error text rather than a friendly apology.
 * The audience for a crash screen is whoever has to fix it.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[render error]", error);
  }, [error]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="text-4xl mb-4">🦉</div>
      <h1 className="text-lg font-bold text-ink mb-2">Something broke</h1>
      <p className="text-sm text-ink-muted mb-6 max-w-sm">
        This screen failed to render. The details below are what went wrong.
      </p>

      <pre className="w-full max-w-sm overflow-x-auto rounded-xl border border-[var(--border)] bg-canvas p-3 text-left text-xs text-ink whitespace-pre-wrap break-words">
        {error.message || "No error message"}
        {error.digest ? `\n\ndigest: ${error.digest}` : ""}
      </pre>

      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-[var(--primary)] text-white"
        >
          Try again
        </button>
        <button
          onClick={() => {
            window.location.href = "/";
          }}
          className="px-5 py-2.5 text-sm font-medium rounded-xl border border-[var(--border)] text-ink-muted"
        >
          Go home
        </button>
      </div>
    </main>
  );
}
