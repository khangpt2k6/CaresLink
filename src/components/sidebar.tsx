"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarClock,
  Clock,
  Lightbulb,
  LogOut,
} from "lucide-react";
import { useUser, useClerk } from "@clerk/nextjs";

const employerNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/interviews", label: "Interviews", icon: Calendar },
  { href: "/calendar", label: "Calendar", icon: CalendarClock },
  { href: "/insights", label: "Insights", icon: Lightbulb },
];

const candidateNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/interviews", label: "My Interviews", icon: Calendar },
  { href: "/availability", label: "My Availability", icon: Clock },
  { href: "/book", label: "Book Interview", icon: CalendarClock },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setRole(d.role));
  }, []);

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-56 bg-[#e8ecf2]">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 px-4 border-b border-black/10">
          <Image
            src="/careslink.png"
            alt="CaresLink"
            width={28}
            height={28}
            className="rounded-md"
          />
          <Link href="/" className="text-sm font-semibold text-[#1a2b3c]">
            CaresLink
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {(role === "CANDIDATE" ? candidateNav : employerNav).map((item) => {
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
                    : "text-[#5a6b7c] hover:bg-black/5 hover:text-[#1a2b3c]"
                )}
              >
                <item.icon className="h-[16px] w-[16px] flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-black/10 px-3 py-3 space-y-3">
          {user && (
            <div className="flex items-center gap-2.5 px-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0090d9] text-[11px] font-semibold text-white">
                {user.firstName?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-[#1a2b3c] truncate">
                  {user.fullName || user.primaryEmailAddress?.emailAddress}
                </div>
                <div className="text-[10px] text-[#475569] truncate">
                  {user.primaryEmailAddress?.emailAddress}
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => signOut({ redirectUrl: "/sign-in" })}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-[#5a6b7c] hover:bg-black/5 hover:text-[#1a2b3c] transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
