"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import ErrorDialog from "@/components/ErrorDialog";
import { DEBUG_UI } from "@/lib/debug-config";

interface SimulatedError {
  label: string;
  title: string;
  message: string;
}

/**
 * Page-specific error simulators — maps routes to the errors they can show.
 */
const PAGE_ERRORS: Record<string, SimulatedError[]> = {
  "/transactions/new": [
    {
      label: "Save failed (validation)",
      title: "Save failed",
      message: "Transaction description is required.",
    },
    {
      label: "Save failed (server error)",
      title: "Save failed",
      message: "A database error occurred. Please try again.",
    },
    {
      label: "LLM scan error (generic)",
      title: "Scan failed",
      message: "Failed to scan receipt. Please try again.",
    },
    {
      label: "LLM scan error (quota)",
      title: "Scan failed",
      message: "Scan is temporarily unavailable. Please try again later.",
    },
  ],
  "/transactions": [
    {
      label: "Load transactions failed",
      title: "Error",
      message: "Failed to load transactions.",
    },
  ],
  "/friends": [
    {
      label: "Load friends failed",
      title: "Error",
      message: "Failed to load friends.",
    },
  ],
  "/settle-up": [
    {
      label: "Mark paid failed",
      title: "Payment failed",
      message: "Failed to record payment. Please try again.",
    },
  ],
};

// Patterns: match /transactions/[id] but not /transactions/new
const TX_DETAIL_RE = /^\/transactions\/(?!new\b)[^/]+$/;

const TX_DETAIL_ERRORS: SimulatedError[] = [
  {
    label: "Delete failed",
    title: "Delete failed",
    message: "Failed to delete transaction. Please try again.",
  },
  {
    label: "Mark settled failed",
    title: "Mark settled failed",
    message: "Failed to mark as settled. Please try again.",
  },
  {
    label: "Transaction not found",
    title: "Not found",
    message: "Transaction not found.",
  },
];

const DB_ACTIONS = [
  "Delete all transactions",
  "Full database reset",
] as const;

/**
 * Floating debug panel that appears when DEBUG_UI is true.
 * Provides DB actions and page-specific error simulators.
 */
export default function DebugMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });

  // Determine which simulators to show based on the current route
  const currentErrors = PAGE_ERRORS[pathname] ?? null;
  const isTxDetail = TX_DETAIL_RE.test(pathname);
  const hasSimulators = currentErrors || isTxDetail;

  const handleSimulate = useCallback((title: string, message: string) => {
    setErrorDialog({ open: true, title, message });
  }, []);

  const handleDbAction = useCallback(async (action: string) => {
    setOpen(false);

    if (action === "Delete all transactions") {
      if (!confirm("Delete ALL transactions?")) return;
      await fetch("/api/debug?action=delete-all-transactions", { method: "POST" });
      window.location.reload();
    } else if (action === "Full database reset") {
      if (!confirm("Reset entire database? This will delete everything.")) return;
      await fetch("/api/debug?action=reset", { method: "POST" });
      window.location.reload();
    }
  }, []);

  if (!DEBUG_UI) return null;

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed left-3 bottom-20 z-40 w-10 h-10 flex items-center justify-center
                   bg-amber-400 text-white rounded-full shadow-lg
                   hover:bg-amber-500 transition-colors text-lg"
        title="Debug menu"
        aria-label="Open debug menu"
      >
        🐛
      </button>

      {/* Panel */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed left-3 bottom-[7.5rem] z-50 w-64 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-gray-100 bg-amber-50">
              <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                🐛 Debug Menu
              </h3>
              <p className="text-[10px] text-amber-600 mt-0.5">
                {pathname}
              </p>
            </div>

            {/* DB Actions */}
            <div className="px-4 py-2.5 border-b border-gray-100">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Database
              </p>
              <div className="space-y-1">
                {DB_ACTIONS.map((action) => (
                  <button
                    key={action}
                    onClick={() => handleDbAction(action)}
                    className="w-full text-left text-xs text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-md transition-colors"
                  >
                    {action}
                  </button>
                ))}
              </div>
              <a
                href="/debug"
                className="block text-xs text-blue-600 hover:bg-blue-50 px-2 py-1.5 rounded-md mt-1 transition-colors"
              >
                Go to full debug page →
              </a>
            </div>

            {/* Error simulators */}
            <div className="px-4 py-2.5">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Error simulators
              </p>
              {hasSimulators ? (
                <div className="space-y-1">
                  {currentErrors?.map((err) => (
                    <button
                      key={err.label}
                      onClick={() => {
                        setOpen(false);
                        handleSimulate(err.title, err.message);
                      }}
                      className="w-full text-left text-xs text-gray-700 hover:bg-gray-100 px-2 py-1.5 rounded-md transition-colors"
                    >
                      {err.label}
                    </button>
                  ))}
                  {isTxDetail && TX_DETAIL_ERRORS.map((err) => (
                    <button
                      key={err.label}
                      onClick={() => {
                        setOpen(false);
                        handleSimulate(err.title, err.message);
                      }}
                      className="w-full text-left text-xs text-gray-700 hover:bg-gray-100 px-2 py-1.5 rounded-md transition-colors"
                    >
                      {err.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400 italic">
                  No page-specific simulators for this page.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Error dialog triggered by simulators */}
      <ErrorDialog
        open={errorDialog.open}
        title={errorDialog.title}
        message={errorDialog.message}
        onDismiss={() => setErrorDialog({ open: false, title: "", message: "" })}
      />
    </>
  );
}
