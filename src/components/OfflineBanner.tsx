"use client";

import { useEffect, useState } from "react";

/**
 * Persistent top banner shown whenever the browser is offline. Toggles
 * `offline-banner-visible` on <html> so globals.css can shift the fixed
 * header and page content down by --offline-banner-h instead of the banner
 * overlapping them.
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("offline-banner-visible", offline);
  }, [offline]);

  if (!offline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white text-xs font-medium text-center py-2 px-4">
      You&apos;re offline — showing data from your last sync
    </div>
  );
}
