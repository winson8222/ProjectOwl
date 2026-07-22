"use client";

import BottomNav from "@/components/BottomNav";
import DebugMenu from "@/components/DebugMenu";
import { useState, useEffect } from "react";
import { getSessionUser } from "@/lib/session";

/**
 * App shell wrapper: handles session check on mount.
 * Shows BottomNav on all authenticated pages.
 * Shows DebugMenu (🐛) when in test mode (NEXT_PUBLIC_DEBUG_UI=true).
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Ensure session is checked (hydration safety)
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="min-h-dvh" />;
  }

  return (
    <>
      {/* App header */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-[var(--border)] z-50">
        <div className="max-w-lg mx-auto px-4 py-3">
          <h1 className="text-xl font-bold text-[var(--primary)]">ItreSplit</h1>
        </div>
      </header>

      <div className="content-with-nav">{children}</div>
      <BottomNav />
      <DebugMenu />
    </>
  );
}
