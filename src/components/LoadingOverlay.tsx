"use client";

import Portal from "@/components/Portal";

/**
 * Generic blocking overlay for an in-flight action (saving, submitting).
 *
 * NOT the receipt-scan loader — that's ScanLoader, which takes over the whole
 * screen with the owl. This one stays a small card over a dimmed page, because
 * it covers short operations where a full-screen takeover would be heavier
 * than the wait it's covering.
 */
export default function LoadingOverlay({
  message = "Saving…",
}: {
  message?: string;
}) {
  return (
    <Portal>
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/25 backdrop-blur-sm px-6"
      role="status"
      aria-live="polite"
    >
      <div
        className="flex flex-col items-center gap-3 px-8 py-7 rounded-[20px]"
        style={{
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-hairline)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
        }}
      >
        <span
          className="w-8 h-8 rounded-full animate-spin"
          style={{
            border: "3px solid var(--color-hairline)",
            borderTopColor: "var(--color-blueberry-600)",
          }}
        />
        <p className="text-callout font-medium text-ink">{message}</p>
      </div>
    </div>
    </Portal>
  );
}
