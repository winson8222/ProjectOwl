"use client";

/**
 * Root layout template - passes through children
 * Page transitions handled by PageSlider in AppShell for main pages
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

