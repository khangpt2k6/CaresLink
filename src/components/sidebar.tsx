"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Lightbulb,
  Activity,
  Sparkles,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/interviews", label: "Interviews", icon: Calendar },
  { href: "/insights", label: "Insights", icon: Lightbulb },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass-strong fixed left-0 top-0 z-40 h-screen w-56">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg shadow-teal-500/20">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <Link href="/" className="text-base font-bold gradient-text tracking-tight">
            CaresLink
          </Link>
        </div>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-teal-200/60 to-transparent" />

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-5">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                  isActive
                    ? "nav-active bg-teal-50/80 text-teal-800 shadow-sm"
                    : "text-teal-600/70 hover:bg-teal-50/40 hover:text-teal-800"
                )}
              >
                <item.icon
                  className={cn(
                    "h-[18px] w-[18px] transition-colors",
                    isActive ? "text-teal-600" : "text-teal-400/70"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-teal-200/60 to-transparent" />

        {/* Footer */}
        <div className="p-4">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-teal-400" />
            <p className="text-[11px] font-medium text-teal-500">Powered by Gemini AI</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
