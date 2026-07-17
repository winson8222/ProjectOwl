"use client";

interface ErrorDialogProps {
  open: boolean;
  title?: string;
  message: string;
  dismissLabel?: string;
  onDismiss: () => void;
}

/**
 * Modal overlay for error messages, matching the look of ConfirmDialog.
 * Use this for POST action failures (save, delete, mark-paid).
 */
export default function ErrorDialog({
  open,
  title = "Error",
  message,
  dismissLabel = "Dismiss",
  onDismiss,
}: ErrorDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
        <div className="flex flex-col items-center text-center mb-4">
          <span className="text-3xl mb-3">⚠️</span>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-sm text-gray-500 mb-6 text-center">{message}</p>
        <button
          onClick={onDismiss}
          className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}
