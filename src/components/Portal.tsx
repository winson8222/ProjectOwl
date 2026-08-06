"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into <body>, outside the React tree.
 *
 * Required for anything using `position: fixed` on a PageSlider tab. The
 * slider animates `transform: translateX()` on its track, and a transformed
 * ancestor does two things to fixed descendants:
 *
 *   1. becomes their containing block — so `inset: 0` resolves against the
 *      track, not the viewport
 *   2. creates a stacking context — so an overlay's z-50 is trapped inside it
 *      and the app header (z-50 at the root) paints on top
 *
 * The visible symptom was a full-screen sheet whose own header sat underneath
 * the app header, leaving no way to Cancel or Save. Portalling to body escapes
 * the transform entirely.
 */
export default function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // Portals need a DOM target, so nothing renders during SSR.
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
