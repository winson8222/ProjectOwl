"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpring, animated } from "@react-spring/web";
import { tapLight } from "@/lib/haptics";

const REVEAL_WIDTH = 88;
/** Past this much drag, release snaps open instead of closed. */
const OPEN_THRESHOLD = 40;
/** Movement beyond this cancels the child's click, so a swipe never navigates. */
const DRAG_SLOP = 6;

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  /** Disables the gesture (e.g. while a delete is already in flight). */
  disabled?: boolean;
  deleteLabel?: string;
}

/**
 * Swipe-to-reveal a delete action.
 *
 * Deliberately two-stage: the swipe only *reveals* the button, and deleting
 * takes a second, explicit tap. Swipe-to-commit would put an irreversible
 * action one stray gesture away in a scrolling list — the row is a link, so
 * fingers are already moving across it.
 *
 * Vertical intent wins: if the first movement is more vertical than
 * horizontal the gesture is abandoned so the list scrolls normally.
 */
export default function SwipeableRow({
  children,
  onDelete,
  disabled = false,
  deleteLabel = "Delete",
}: SwipeableRowProps) {
  const [open, setOpen] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const decided = useRef(false);
  const moved = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [{ x }, api] = useSpring(() => ({
    x: 0,
    config: { tension: 380, friction: 34 },
  }));

  const close = useCallback(() => {
    setOpen(false);
    api.start({ x: 0 });
  }, [api]);

  // Any tap elsewhere closes an open row — the same way a native list behaves.
  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [open, close]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    dragging.current = true;
    decided.current = false;
    moved.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || disabled) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // First meaningful movement decides whether this is a scroll or a swipe.
    if (!decided.current) {
      if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        dragging.current = false;
        return;
      }
      decided.current = true;
    }

    moved.current = true;
    const base = open ? -REVEAL_WIDTH : 0;
    let next = base + dx;
    // Clamp: no rightward overscroll, and resistance past the reveal width.
    if (next > 0) next = 0;
    if (next < -REVEAL_WIDTH) {
      next = -REVEAL_WIDTH + (next + REVEAL_WIDTH) * 0.25;
    }
    api.set({ x: next });
  };

  const onTouchEnd = () => {
    if (!dragging.current || disabled) return;
    dragging.current = false;
    if (!decided.current) return;

    const current = x.get();
    const shouldOpen = current < -OPEN_THRESHOLD;
    if (shouldOpen !== open) tapLight();
    setOpen(shouldOpen);
    api.start({ x: shouldOpen ? -REVEAL_WIDTH : 0 });
  };

  // A swipe must never trigger the underlying link.
  const onClickCapture = (e: React.MouseEvent) => {
    if (moved.current || open) {
      e.preventDefault();
      e.stopPropagation();
      if (open) close();
      moved.current = false;
    }
  };

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-[14px]">
      {/* Delete action, revealed underneath. */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: REVEAL_WIDTH }}
      >
        <button
          type="button"
          onClick={() => {
            close();
            onDelete();
          }}
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
          className="pressable flex flex-col items-center justify-center gap-1 w-full text-white font-semibold text-footnote"
          style={{ background: "var(--color-negative)" }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M4 7h16M10 11v6M14 11v6" />
            <path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" />
            <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
          </svg>
          {deleteLabel}
        </button>
      </div>

      <animated.div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClickCapture={onClickCapture}
        style={{ transform: x.to((v) => `translateX(${v}px)`) }}
      >
        {children}
      </animated.div>
    </div>
  );
}
