"use client";

import BottomNav from "@/components/BottomNav";
import DebugMenu from "@/components/DebugMenu";
import PageSlider from "@/components/PageSlider";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * App shell wrapper: handles session check on mount.
 * Shows BottomNav on all authenticated pages.
 * Shows DebugMenu (🐛) when in test mode (NEXT_PUBLIC_DEBUG_UI=true).
 * Uses PageSlider for iOS-style horizontal page transitions.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Ensure session is checked (hydration safety)
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="min-h-dvh" />;
  }

  // Only use PageSlider for main navigation pages
  const mainPages = ["/", "/groups", "/transactions/new", "/activity"];
  const isMainPage = mainPages.includes(pathname);

  return (
    <>
      {/* App header */}
      <header className="fixed top-0 left-0 right-0 border-b border-[var(--border)] z-50 backdrop-blur-sm"
              style={{ background: 'rgba(255,255,255,0.4)' }}>
        <div className="max-w-lg mx-auto px-4 py-3">
          <h1 className="text-xl font-bold text-[var(--primary)]">ItreSplit</h1>
        </div>
      </header>

      {isMainPage ? (
        <PageSlider />
      ) : (
        <div className="content-with-nav" style={{ position: 'relative', height: '100%' }}>{children}</div>
      )}
      <BottomNav />
      <DebugMenu />
    </>
  );
}
