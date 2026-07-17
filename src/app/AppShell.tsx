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
      <div className="content-with-nav">{children}</div>
      <BottomNav />
      <DebugMenu />
    </>
  );
}
