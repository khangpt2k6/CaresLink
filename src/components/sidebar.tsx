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
        <div className="flex h-14 items-center gap-2.5 px-5">
          <Activity className="h-5 w-5 text-teal-600" />
          <Link href="/" className="text-base font-semibold text-teal-900 tracking-tight">
            CaresLink
          </Link>
        </div>

        <div className="mx-4 h-px bg-teal-100/60" />

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-teal-50/80 text-teal-800"
                    : "text-teal-700/70 hover:bg-teal-50/40 hover:text-teal-800"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-teal-600" : "text-teal-500/60")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mx-4 h-px bg-teal-100/60" />
        <div className="p-4">
          <p className="text-[11px] text-teal-500">Powered by Gemini AI</p>
        </div>
      </div>
    </aside>
  );
}
