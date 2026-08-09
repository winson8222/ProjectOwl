"use client";

import { useEffect, useRef, useState } from "react";
import { useSpring, animated } from "@react-spring/web";

const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 0.5;

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Announced to screen readers as the sheet's name. */
  label?: string;
  /**
   * Blocks backdrop-tap and swipe-down dismissal. For sheets whose only
   * correct exits are the buttons inside them — a destructive confirm should
   * not be dismissible by a stray downward flick.
   */
  dismissible?: boolean;
}

/**
 * Sheet that rises from the bottom edge, replacing centred modal dialogs.
 *
 * A centred dialog puts its buttons mid-screen, which on a phone is the one
 * region a thumb can't reach without shifting grip. Anchoring to the bottom
 * puts the actions where the hand already is, and the drag-to-dismiss gesture
 * gives an exit that doesn't require aiming at anything.
 */
export default function BottomSheet({
  open,
  onClose,
  children,
  label,
  dismissible = true,
}: BottomSheetProps) {
  // Kept mounted through the exit animation, then unmounted.
  const [present, setPresent] = useState(open);
  const startY = useRef(0);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const dragging = useRef(false);

  const [{ y }, api] = useSpring(() => ({
    y: open ? 0 : 1000,
    config: { tension: 280, friction: 32 },
  }));

  const [backdrop, backdropApi] = useSpring(() => ({ opacity: open ? 1 : 0 }));

  useEffect(() => {
    if (open) {
      setPresent(true);
      api.start({ y: 0 });
      backdropApi.start({ opacity: 1 });
    } else if (present) {
      backdropApi.start({ opacity: 0 });
      api.start({ y: 1000, onRest: () => setPresent(false) });
    }
  }, [open]);

  // Escape closes, and the page behind must not scroll while a sheet is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, dismissible, onClose]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!dismissible) return;
    dragging.current = true;
    startY.current = e.touches[0].clientY;
    lastY.current = e.touches[0].clientY;
    lastT.current = Date.now();
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    const dy = e.touches[0].clientY - startY.current;
    lastY.current = e.touches[0].clientY;
    lastT.current = Date.now();
    // Downward drag tracks the finger; upward gets heavy resistance so the
    // sheet feels anchored rather than detached.
    api.set({ y: dy > 0 ? dy : dy * 0.12 });
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const dy = e.changedTouches[0].clientY - startY.current;
    const dt = Math.max(1, Date.now() - lastT.current);
    const velocity = (e.changedTouches[0].clientY - lastY.current) / dt;

    if (dy > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) onClose();
    else api.start({ y: 0 });
  };

  if (!present) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <animated.button
        aria-label="Close"
        tabIndex={-1}
        onClick={() => dismissible && onClose()}
        className="absolute inset-0 bg-black/40 cursor-default"
        style={{ opacity: backdrop.opacity }}
      />

      <animated.div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative w-full max-w-lg"
        style={{
          transform: y.to((v) => `translateY(${v}px)`),
          background: "var(--color-surface-raised)",
          borderTopLeftRadius: "var(--radius-sheet)",
          borderTopRightRadius: "var(--radius-sheet)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {dismissible && (
          <div className="flex justify-center pt-2.5 pb-1">
            <span
              aria-hidden
              className="block rounded-full"
              style={{
                width: 36,
                height: 5,
                background: "var(--color-hairline)",
              }}
            />
          </div>
        )}
        <div className="px-5 pt-3">{children}</div>
      </animated.div>
    </div>
  );
}
