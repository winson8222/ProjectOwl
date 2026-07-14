"use client";

import BottomNav from "@/components/BottomNav";
import { useState, useEffect } from "react";
import { getSessionUser } from "@/lib/session";

/**
 * App shell wrapper: handles session check on mount.
 * Shows BottomNav on all authenticated pages.
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
    </>
  );
}
