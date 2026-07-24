"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSwipeable } from "react-swipeable";
import { useSpring, animated } from "@react-spring/web";
import HomePage from "@/app/page";
import GroupsPage from "@/app/groups/page";
import NewTransactionPage from "@/app/transactions/new/page";
import ActivityPage from "@/app/activity/page";

/**
 * iOS-style page sliding container
 * Renders all main pages horizontally and slides between them like a canvas
 */
export default function PageSlider() {
  const pathname = usePathname();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  // Page positions and widths
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const pageWidth = useRef(0);

  // All pages in order
  const pages = ["/", "/groups", "/transactions/new", "/activity"];

  // Map pathnames to page components
  const getPageComponent = (path: string) => {
    switch (path) {
      case "/": return <HomePage />;
      case "/groups": return <GroupsPage />;
      case "/transactions/new": return <NewTransactionPage />;
      case "/activity": return <ActivityPage />;
      default: return null;
    }
  };

  // Animated position for smooth sliding
  const [{ x }, api] = useSpring(() => ({
    x: 0,
    config: {
      tension: 300,
      friction: 30,
    },
  }));

  // Track current page index based on pathname
  useEffect(() => {
    const index = pages.findIndex((path) => {
      if (path === "/transactions/new") {
        return pathname === "/transactions/new";
      }
      return pathname === path;
    });

    if (index !== -1 && index !== currentPageIndex) {
      setCurrentPageIndex(index);
    }
  }, [pathname]);

  // Update position when page changes
  useEffect(() => {
    if (containerRef.current) {
      pageWidth.current = containerRef.current.offsetWidth;
    }
    api.start({ x: -currentPageIndex * pageWidth.current });
  }, [currentPageIndex]);

  // Update page width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        pageWidth.current = containerRef.current.offsetWidth;
        api.start({ x: -currentPageIndex * pageWidth.current });
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [currentPageIndex]);

  // Handle swipe gestures
  const handlers = useSwipeable({
    onSwiping: (e) => {
      const newX = -currentPageIndex * pageWidth.current + e.deltaX;
      api.set({ x: newX });
    },
    onSwipedLeft: () => {
      if (currentPageIndex < pages.length - 1) {
        const nextPage = pages[currentPageIndex + 1];
        router.push(nextPage);
      } else {
        api.start({ x: -currentPageIndex * pageWidth.current });
      }
    },
    onSwipedRight: () => {
      if (currentPageIndex > 0) {
        const prevPage = pages[currentPageIndex - 1];
        router.push(prevPage);
      } else {
        api.start({ x: -currentPageIndex * pageWidth.current });
      }
    },
    trackMouse: true,
    trackTouch: true,
  });

  // Find which page corresponds to current children
  const getCurrentPagePath = () => {
    const pathIndex = pages.findIndex(path => pathname.startsWith(path));
    return pathIndex !== -1 ? pages[pathIndex] : pathname;
  };

  return (
    <div
      {...handlers}
      ref={containerRef}
      className="page-slider-container"
      style={{
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
        height: '100vh',
      }}
    >
      <animated.div
        className="page-slider-track"
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          transform: x.to((x) => `translateX(${x}px)`),
        }}
      >
        {pages.map((path, idx) => (
          <div
            key={path}
            className="page-slide"
            style={{
              flex: '0 0 100%',
              width: '100%',
              height: '100%',
              position: 'relative',
              paddingTop: '4rem',
              paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 1rem)',
              overflowY: 'auto',
            }}
          >
            {getPageComponent(path)}
          </div>
        ))}
      </animated.div>
    </div>
  );
}
