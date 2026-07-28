"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/groups", label: "Groups", icon: "⊟" },
  { href: "/transactions/new", label: "Add", icon: "+" },
  { href: "/activity", label: "Activity", icon: "◉" },
];

/**
 * Floating bottom navigation bar with minimalist theme.
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

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    router.push(href);
  };

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 safe-area-bottom">
      <div className="flex items-center gap-2 px-4 py-2 rounded-full shadow-lg border border-gray-100 backdrop-blur-sm"
           style={{ background: 'rgba(255,255,255,0.3)' }}>
        {tabs.map((tab) => {
          // Strip query params for active-state comparison —
          // the pathname never includes them.
          const baseHref = tab.href.split("?")[0];
          const isActive = baseHref === "/"
            ? pathname === "/"
            : pathname.startsWith(baseHref);

          return (
            <Link
              key={tab.label}
              href={tab.href}
              onClick={(e) => handleNavClick(e, tab.href)}
              className={`flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium rounded-xl transition-all ${
                isActive
                  ? "text-[var(--primary)] bg-gray-50"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
