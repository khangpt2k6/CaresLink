"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Lightbulb,
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
    <aside className="fixed left-0 top-0 z-40 h-screen w-56 border-r border-[#e8e8e5] bg-[#fbfbfa]">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 px-4">
          <Image
            src="/careslink_logo.jpg"
            alt="CaresLink"
            width={28}
            height={28}
            className="rounded-md"
          />
          <Link href="/" className="text-sm font-semibold text-[#37352f]">
            CaresLink
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-2 py-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-colors duration-100",
                  isActive
                    ? "nav-active text-[#37352f]"
                    : "text-[#73726e] hover:bg-[#f0f0ee] hover:text-[#37352f]"
                )}
              >
                <item.icon className="h-[16px] w-[16px] flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-[#e8e8e5] px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] text-[#9b9a97]">
            <Sparkles className="h-3 w-3" />
            Powered by Gemini AI
          </div>
        </div>
      </div>
    </aside>
  );
}
