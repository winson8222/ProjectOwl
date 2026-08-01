"use client";

import { useCallback, useRef, useState } from "react";

const PULL_THRESHOLD = 70;
const MAX_PULL = 120;
const SPINNER_REST_HEIGHT = 48;

/**
 * Native-style pull-to-refresh. Only main pages get overscroll bounce
 * disabled (see html/body overscroll-behavior: none in globals.css), so
 * this replaces it with an explicit gesture. Detects the drag via touch
 * events on its own wrapper, but reads scrollTop off the nearest `.page-slide`
 * ancestor (the actual scroll container in PageSlider) rather than itself,
 * since this component doesn't own the scroll container.
 */
export default function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<unknown> | unknown;
  children: React.ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollElRef = useRef<HTMLElement | null>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const getScrollEl = useCallback(() => {
    if (!scrollElRef.current) {
      scrollElRef.current =
        (wrapperRef.current?.closest(".page-slide") as HTMLElement | null) ??
        wrapperRef.current?.parentElement ??
        null;
    }
    return scrollElRef.current;
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing) return;
      const scrollEl = getScrollEl();
      if (!scrollEl || scrollEl.scrollTop > 0) {
        isPulling.current = false;
        return;
      }
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    },
    [refreshing, getScrollEl]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling.current || refreshing) return;
      const scrollEl = getScrollEl();
      if (!scrollEl || scrollEl.scrollTop > 0) {
        isPulling.current = false;
        setPullDistance(0);
        return;
      }
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        setPullDistance(0);
        return;
      }
      // Resistance: pulling further yields diminishing distance.
      setPullDistance(Math.min(MAX_PULL, delta * 0.5));
    },
    [refreshing, getScrollEl]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullDistance >= PULL_THRESHOLD) {
      setRefreshing(true);
      setPullDistance(SPINNER_REST_HEIGHT);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh]);

  const showSpinner = pullDistance > 0 || refreshing;
  const spinnerProgress = Math.min(1, pullDistance / PULL_THRESHOLD);

  return (
    <div
      ref={wrapperRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: pullDistance,
          transition: isPulling.current ? "none" : "height 0.2s ease-out",
        }}
      >
        {showSpinner && (
          <div
            className={`w-6 h-6 border-2 border-[var(--border)] border-t-[var(--primary)] rounded-full ${
              refreshing ? "animate-spin" : ""
            }`}
            style={
              refreshing
                ? undefined
                : { transform: `rotate(${spinnerProgress * 180}deg)`, opacity: spinnerProgress }
            }
          />
        )}
      </div>
      {children}
    </div>
  );
}
