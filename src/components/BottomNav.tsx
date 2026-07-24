"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
  const router = useRouter();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    router.push(href);
  };

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 safe-area-bottom">
      <div className="flex items-center gap-2 px-4 py-2 rounded-full shadow-lg border border-gray-100 backdrop-blur-sm"
           style={{ background: 'rgba(255,255,255,0.3)' }}>
        {tabs.map((tab) => {
          const isActive = tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
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
