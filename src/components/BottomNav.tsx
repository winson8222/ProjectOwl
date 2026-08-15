"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSpring, animated } from "@react-spring/web";
import { HomeIcon, GroupsIcon, AddIcon, ActivityIcon } from "./NavIcons";
import { tapLight } from "@/lib/haptics";
import { guardedNavigate } from "@/lib/draft-guard";

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/groups", label: "Groups", Icon: GroupsIcon },
  { href: "/transactions/new", label: "Add", Icon: AddIcon },
  { href: "/activity", label: "Activity", Icon: ActivityIcon },
];

/**
 * Floating island navigation.
 *
 * A single blueberry pill slides between tabs on a spring with slight
 * overshoot, rather than four icons independently changing color. It's the
 * only element in the app allowed to overshoot, which is what makes the bar
 * read as a physical object while everything around it stays still.
 *
 * When the user is on a group page (e.g. /groups/<id>), the "Add" button
 * deep-links to /transactions/new?groupId=<id> so the group is pre-selected.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  // If we're on a group detail page, carry the group id into the "Add" link
  // so the transaction page pre-selects that group.
  const groupMatch = pathname.match(/^\/groups\/([^/]+)/);
  const activeGroupId = groupMatch ? groupMatch[1] : null;

  const tabs = activeGroupId
    ? TABS.map((t) =>
        t.label === "Add"
          ? { ...t, href: `/transactions/new?groupId=${activeGroupId}` }
          : t
      )
    : TABS;

  const isTabActive = (href: string) => {
    // Strip query params for active-state comparison —
    // the pathname never includes them.
    const baseHref = href.split("?")[0];
    return baseHref === "/" ? pathname === "/" : pathname.startsWith(baseHref);
  };

  const activeIndex = tabs.findIndex((t) => isTabActive(t.href));

  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pill, setPill] = useState({ x: 0, width: 0, ready: false });

  // Measure the active tab's box so the pill can sit exactly on it. Layout
  // effect so the first paint already has the correct geometry rather than
  // animating in from zero.
  useLayoutEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (!el) return;
    setPill({ x: el.offsetLeft, width: el.offsetWidth, ready: true });
  }, [activeIndex, pathname]);

  // Re-measure if the viewport changes width under us.
  useEffect(() => {
    const remeasure = () => {
      const el = itemRefs.current[activeIndex];
      if (el) setPill({ x: el.offsetLeft, width: el.offsetWidth, ready: true });
    };
    window.addEventListener("resize", remeasure);
    return () => window.removeEventListener("resize", remeasure);
  }, [activeIndex]);

  const pillStyle = useSpring({
    x: pill.x,
    width: pill.width,
    opacity: pill.ready && activeIndex >= 0 ? 1 : 0,
    // Overshoot lives here and nowhere else.
    config: { tension: 340, friction: 26 },
    immediate: !pill.ready,
  });

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    tapLight();
    // Routed through the guard so an unsaved expense draft gets a chance to
    // stop the move — otherwise tapping a tab silently discards it.
    guardedNavigate(() => router.push(href));
  };

  return (
    <nav
      className="fixed left-1/2 -translate-x-1/2 z-40"
      style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
      aria-label="Primary"
    >
      <div
        className="relative flex items-center p-1.5"
        style={{
          background: "color-mix(in srgb, var(--color-surface-raised) 78%, transparent)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid var(--color-hairline)",
          borderRadius: "var(--radius-island)",
          boxShadow:
            "0 8px 24px color-mix(in srgb, var(--color-blueberry-900) 12%, transparent), 0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 6%, transparent)",
        }}
      >
        {/* The sliding pill, behind the tabs. */}
        {/* left-0 is load-bearing: without it the pill's horizontal origin is
            the flex CONTENT box (inside p-1.5), while offsetLeft below is
            measured from the PADDING box — putting every tab 6px out. */}
        <animated.span
          aria-hidden
          className="absolute left-0 top-1.5 bottom-1.5 rounded-[20px] pointer-events-none"
          style={{
            background: "var(--color-blueberry-100)",
            transform: pillStyle.x.to((x) => `translateX(${x}px)`),
            width: pillStyle.width,
            opacity: pillStyle.opacity,
          }}
        />

        {tabs.map((tab, i) => {
          const isActive = i === activeIndex;
          const { Icon } = tab;

          return (
            <Link
              key={tab.label}
              href={tab.href}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              onClick={(e) => handleNavClick(e, tab.href)}
              aria-current={isActive ? "page" : undefined}
              className="pressable-sm relative z-10 flex flex-col items-center justify-center gap-0.5 rounded-[20px] transition-colors"
              style={{
                minWidth: 64,
                minHeight: 52,
                paddingInline: 12,
                color: isActive
                  ? "var(--color-blueberry-600)"
                  : "var(--color-blueberry-300)",
              }}
            >
              <Icon />
              <span
                className="text-caption"
                style={{ fontWeight: isActive ? 600 : 500 }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
