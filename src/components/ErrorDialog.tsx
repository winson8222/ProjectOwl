"use client";

import BottomSheet from "./BottomSheet";

interface ErrorDialogProps {
  open: boolean;
  title?: string;
  message: string;
  dismissLabel?: string;
  onDismiss: () => void;
}

/**
 * Error surface for failed actions (save, delete, mark-paid).
 *
 * Presented as a bottom sheet rather than a centred dialog — same props, so
 * every call site is unchanged. The ⚠️ emoji it used to lead with is gone:
 * the message says what went wrong, and a warning glyph above it just delays
 * reading that.
 */
export default function ErrorDialog({
  open,
  title = "Something went wrong",
  message,
  dismissLabel = "OK",
  onDismiss,
}: ErrorDialogProps) {
  return (
    <BottomSheet open={open} onClose={onDismiss} label={title}>
      <h3 className="text-title2 font-bold text-ink">{title}</h3>
      <p className="text-body text-ink-muted mt-2 mb-5">{message}</p>
      <button
        onClick={onDismiss}
        className="pressable w-full rounded-[12px] text-body font-semibold text-white"
        style={{
          minHeight: 50,
          background: "var(--color-blueberry-600)",
        }}
      >
        {dismissLabel}
      </button>
    </BottomSheet>
  );
}
