"use client";

import BottomNav from "@/components/BottomNav";
import DebugMenu from "@/components/DebugMenu";
import DraftLeaveGuard from "@/components/DraftLeaveGuard";
import LoginScreen from "@/components/LoginScreen";
import PageSlider from "@/components/PageSlider";
import OfflineBanner from "@/components/OfflineBanner";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { fetchSessionUser, signOut, type SessionUser } from "@/lib/session";

/**
 * App shell wrapper: resolves the server-verified session before rendering
 * any page (and warms the sessionStorage cache that getSessionUser() reads).
 * Signed out → LoginScreen (seeded-user picker in mock mode, Google OAuth in
 * supabase mode). Shows BottomNav on all authenticated pages and DebugMenu
 * (🐛) when in test mode (NEXT_PUBLIC_DEBUG_UI=true).
 * Uses PageSlider for iOS-style horizontal page transitions.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    fetchSessionUser()
      .then(setUser)
      .finally(() => setReady(true));
  }, []);

  // The service worker is disabled in every environment — see public/sw.js for
  // why. Nothing registers one any more; this actively removes any that a
  // previous build installed.
  //
  // Belt and braces with the self-uninstalling worker: that one only runs if
  // the browser gets as far as fetching the new sw.js, while this runs as soon
  // as the app boots. Between them, a browser holding a broken worker recovers
  // on its next load either way.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});

    // Unregistering leaves Cache Storage behind, and it can be hundreds of MB.
    if (typeof caches !== "undefined") {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => {});
    }
  }, []);

  if (!ready) {
    return <div className="min-h-dvh" />;
  }

  if (!user) {
    return <LoginScreen onSignedIn={() => window.location.reload()} />;
  }

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  // Only use PageSlider for main navigation pages
  const mainPages = ["/", "/groups", "/transactions/new", "/activity"];
  const isMainPage = mainPages.includes(pathname);

  return (
    <>
      <OfflineBanner />

      {/* App header */}
      <header className="fixed left-0 right-0 border-b border-[var(--border)] z-50 backdrop-blur-sm"
              style={{ background: 'rgba(255,255,255,0.4)', top: 'var(--offline-banner-h)' }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--primary)]">ItreSplit</h1>
          <button
            onClick={handleSignOut}
            className="text-xs font-medium text-ink-muted hover:text-ink-muted transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {isMainPage ? (
        <PageSlider />
      ) : (
        <div className="content-with-nav" style={{ position: 'relative', height: '100%' }}>{children}</div>
      )}
      <BottomNav />
      <DraftLeaveGuard />
      <DebugMenu />
    </>
  );
}
