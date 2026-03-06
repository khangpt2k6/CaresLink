"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarClock,
  Lightbulb,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/interviews", label: "Interviews", icon: Calendar },
  { href: "/calendar", label: "Calendar", icon: CalendarClock },
  { href: "/insights", label: "Insights", icon: Lightbulb },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-56 bg-[#0a1628]">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 px-4 border-b border-white/10">
          <Image
            src="/careslink_logo.jpg"
            alt="CaresLink"
            width={28}
            height={28}
            className="rounded-md"
          />
          <Link href="/" className="text-sm font-semibold text-white">
            CaresLink
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors duration-100",
                  isActive
                    ? "nav-active"
                    : "text-[#94a3b8] hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon className="h-[16px] w-[16px] flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 px-4 py-3">
          <div className="text-[11px] text-[#475569]">
            Powered by Gemini AI
          </div>
        </div>
      </div>
    </aside>
  );
}
