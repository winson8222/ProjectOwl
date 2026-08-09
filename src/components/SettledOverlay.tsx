"use client";

import PaidStamp from "./PaidStamp";

/**
 * The moment a balance clears: full-screen, stamp thunks down with sparks,
 * then the page reloads underneath it.
 *
 * Kept separate from PaidStamp so the resting watermark on the balance cards
 * and this one-shot celebration can't drift apart — both draw the same stamp.
 */
export default function SettledOverlay({
  title = "All square",
  detail,
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 px-8"
      style={{
        background: "var(--color-canvas)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      role="status"
      aria-live="polite"
    >
      <div className="relative w-full" style={{ height: 120 }}>
        <PaidStamp celebrate />
      </div>

      <div className="text-center">
        <p className="text-title1 font-bold text-ink">{title}</p>
        {detail && (
          <p className="text-body text-ink-muted mt-1.5">{detail}</p>
        )}
      </div>
    </div>
  );
}
