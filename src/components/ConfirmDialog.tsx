"use client";

import BottomSheet from "./BottomSheet";
import { tapLight } from "@/lib/haptics";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation sheet.
 *
 * Actions stack full-width instead of sitting side by side: two 50% buttons
 * put Cancel and a destructive Confirm within a thumb-width of each other,
 * which is how people delete things they meant to keep. Confirm leads because
 * it's the action being asked about; Cancel sits below it, quiet.
 *
 * Destructive variants are neither swipe- nor backdrop-dismissible — an
 * irreversible choice should require actually answering the question.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const danger = variant === "danger";

  return (
    <BottomSheet
      open={open}
      onClose={onCancel}
      label={title}
      dismissible={!danger}
    >
      <h3 className="text-title2 font-bold text-ink">{title}</h3>
      <p className="text-body text-ink-muted mt-2 mb-5">{message}</p>

      <div className="space-y-2.5">
        <button
          onClick={() => {
            tapLight();
            onConfirm();
          }}
          className="pressable-cta w-full rounded-[12px] text-body font-semibold text-white"
          style={{
            minHeight: 50,
            background: danger
              ? "var(--color-negative)"
              : "var(--color-blueberry-600)",
          }}
        >
          {confirmLabel}
        </button>
        <button
          onClick={onCancel}
          className="pressable-cta w-full rounded-[12px] text-body font-medium text-ink"
          style={{
            minHeight: 50,
            background: "var(--color-surface)",
            border: "1px solid var(--color-hairline)",
          }}
        >
          {cancelLabel}
        </button>
      </div>
    </BottomSheet>
  );
}
