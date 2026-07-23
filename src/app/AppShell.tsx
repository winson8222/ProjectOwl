"use client";

import BottomNav from "@/components/BottomNav";
import DebugMenu from "@/components/DebugMenu";
import LoginScreen from "@/components/LoginScreen";
import { useState, useEffect } from "react";
import { fetchSessionUser, signOut, type SessionUser } from "@/lib/session";

/**
 * App shell wrapper: resolves the server-verified session before rendering
 * any page (and warms the sessionStorage cache that getSessionUser() reads).
 * Signed out → LoginScreen (seeded-user picker in mock mode, Google OAuth in
 * supabase mode). Shows BottomNav on all authenticated pages and DebugMenu
 * (🐛) when in test mode (NEXT_PUBLIC_DEBUG_UI=true).
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetchSessionUser()
      .then(setUser)
      .finally(() => setReady(true));
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

  return (
    <>
      {/* App header */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-[var(--border)] z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--primary)]">ItreSplit</h1>
          <button
            onClick={handleSignOut}
            className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="content-with-nav">{children}</div>
      <BottomNav />
      <DebugMenu />
    </>
  );
}
