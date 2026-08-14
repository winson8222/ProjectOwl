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
 *      track rather than the viewport
 *   2. creates a stacking context — so an overlay's z-index is trapped inside
 *      it and the app header (z-50 at the root) paints on top
 *
 * The visible symptom is a full-screen sheet whose own header sits underneath
 * the app header, leaving no way to Cancel or Save.
 *
 * ItemAssigner solved this inline with createPortal first; this generalises it
 * for the other overlays. Pair it with `z-[55]` — above the header, below the
 * offline banner at z-[60].
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
