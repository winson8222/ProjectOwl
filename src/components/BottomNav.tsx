"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/groups", label: "Groups", icon: "⊟" },
  { href: "/transactions/new", label: "Add", icon: "+" },
  { href: "/activity", label: "Activity", icon: "◉" },
];

/**
 * Floating bottom navigation bar with minimalist theme.
 */
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 safe-area-bottom">
      <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-lg border border-gray-100">
        {tabs.map((tab) => {
          const isActive = tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
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
