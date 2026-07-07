"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/transactions", label: "Transactions", icon: "📋" },
  { href: "/friends", label: "Friends", icon: "👥" },
];

/**
 * Bottom navigation bar with 3 tabs.
 */
export default function BottomNav() {
  const pathname = usePathname();

  // Don't show on the new transaction flow sub-pages (they have their own flow)
  if (pathname.startsWith("/transactions/new") || pathname.startsWith("/settle-up")) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-[var(--border)] bg-white z-40 safe-area-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isActive
                  ? "text-[var(--primary)]"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
