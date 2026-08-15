"use client";

import BottomNav from "@/components/BottomNav";
import SlothMark from "@/components/SlothMark";
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
  /**
   * Make :active fire on iOS Safari.
   *
   * WebKit only applies :active to non-anchor elements when the document has
   * a touch listener — otherwise every press state in the app is dead on
   * iPhone, which is exactly where they matter. An empty listener is the
   * documented workaround. Passive, so it costs nothing on scroll.
   */
  useEffect(() => {
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    return () => document.removeEventListener("touchstart", noop);
  }, []);

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

      {/* App header. Opaque and on the card tone, so it belongs to the same
          family of surfaces as everything below it — content scrolling
          underneath disappears cleanly instead of ghosting through at 40%.
          The blur went with the transparency: nothing left to see through. */}
      <header className="fixed left-0 right-0 border-b border-[var(--border)] z-50"
              style={{ background: 'var(--color-surface)', top: 'var(--offline-banner-h)' }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          {/* Lockup: the sloth in a Blueberry tile, then the wordmark. The
              sloth is the mascot — it already fronts ItreAI — so the header
              and the scan button now point at the same character instead of
              an owl and a sloth competing.

              Colour lives in the tile, so the wordmark stays ink: a coloured
              wordmark next to a coloured mark muddies both. "Split" carries
              the weight because it's the verb — the thing the app does. */}
          <div className="flex items-center gap-2">
            <span
              className="grid place-items-center shrink-0 text-white"
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background:
                  "linear-gradient(150deg, var(--color-blueberry-600) 0%, var(--color-blueberry-700) 100%)",
                boxShadow:
                  "0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.22)",
              }}
            >
              <SlothMark size={26} />
            </span>
            <h1
              className="text-callout text-ink"
              style={{ letterSpacing: "-0.3px" }}
            >
              <span style={{ fontWeight: 500 }}>Itre</span>
              <span style={{ fontWeight: 800 }}>Split</span>
            </h1>
          </div>
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
