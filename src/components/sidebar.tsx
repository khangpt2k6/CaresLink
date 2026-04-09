"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarClock,
  Clock,
  Lightbulb,
  Briefcase,
  LogOut,
  UserCircle,
  Sparkles,
  SlidersHorizontal,
  LayoutList,
  FileText,
  ClipboardCheck,
  Settings,
} from "lucide-react";
import { useUser, useClerk } from "@clerk/nextjs";
import type { LucideProps } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<LucideProps> | "claude";
};

// Claude icon component using the real SVG from public/
function ClaudeIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/Claude_AI_symbol.svg"
      alt="Claude"
      width={16}
      height={16}
      className={className}
    />
  );
}

const employerNav: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/matching", label: "Matching", icon: Sparkles },
  { href: "/interviews", label: "Interviews", icon: Calendar },
  { href: "/calendar", label: "Calendar", icon: CalendarClock },
  { href: "/credential-check", label: "Credential Check", icon: ClipboardCheck },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/claude", label: "Claude AI", icon: "claude" },
  { href: "/settings", label: "Settings", icon: Settings },
];

const candidateNav: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/job-board", label: "Job Board", icon: LayoutList },
  { href: "/profile", label: "My Profile", icon: UserCircle },
  { href: "/resume", label: "My Resume", icon: FileText },
  { href: "/preferences", label: "Job Preferences", icon: SlidersHorizontal },
  { href: "/interviews", label: "My Interviews", icon: Calendar },
  { href: "/availability", label: "My Availability", icon: Clock },
  { href: "/claude", label: "Claude AI", icon: "claude" },
  { href: "/settings", label: "Settings", icon: Settings },
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

  const navItems = role === "CANDIDATE" ? candidateNav : employerNav;

  return (
    <motion.aside
      initial={{ x: -12, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-0 top-0 z-40 h-screen w-56 bg-[#e8ecf2]"
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12, duration: 0.3 }}
          className="flex h-14 items-center gap-2.5 px-4 border-b border-black/10"
        >
          <Image
            src="/careslink.png"
            alt="CaresLink"
            width={28}
            height={28}
            className="rounded-md"
          />
          <Link
            href="/"
            className="text-sm font-semibold text-[#1a2b3c] hover:text-[#0090d9] transition-colors duration-150"
          >
            CaresLink
          </Link>
        </motion.div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {navItems.map((item, index) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: 0.1 + index * 0.045,
                  duration: 0.28,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <Link
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors duration-150",
                    isActive
                      ? "text-[#1a2b3c] font-semibold"
                      : "text-[#5a6b7c] hover:bg-black/5 hover:text-[#1a2b3c]"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-active-indicator"
                      className="absolute inset-0 rounded-lg bg-black/[0.07]"
                      transition={{ type: "spring", bounce: 0.12, duration: 0.4 }}
                    />
                  )}
                  {item.icon === "claude" ? (
                    <ClaudeIcon className="relative h-[16px] w-[16px] flex-shrink-0" />
                  ) : (() => {
                    const Icon = item.icon as React.ComponentType<LucideProps>;
                    return (
                      <Icon
                        className={cn(
                          "relative h-[16px] w-[16px] flex-shrink-0 transition-colors duration-150",
                          isActive ? "text-[#0090d9]" : "text-current"
                        )}
                      />
                    );
                  })()}
                  <span className="relative">{item.label}</span>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.28, duration: 0.3 }}
          className="border-t border-black/10 px-3 py-3 space-y-2"
        >
          {user && (
            <div className="flex items-center gap-2.5 px-1 py-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0090d9] text-[11px] font-semibold text-white ring-2 ring-white/50">
                {user.firstName?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="text-[12px] font-medium text-[#1a2b3c] truncate">
                    {user.firstName || "User"}
                  </div>
                  {role && (
                    <span
                      className={cn(
                        "shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                        role === "CANDIDATE"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-blue-100 text-blue-700"
                      )}
                    >
                      {role === "CANDIDATE" ? "Candidate" : "Employer"}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-[#475569] truncate">
                  {user.primaryEmailAddress?.emailAddress?.replace(/^(.{2}).*(@.*)$/, "$1***$2")}
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => signOut({ redirectUrl: "/sign-in" })}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-[#5a6b7c] hover:bg-black/5 hover:text-[#dc2626] transition-all duration-150 group"
          >
            <LogOut className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            Sign out
          </button>
        </motion.div>
      </div>
    </motion.aside>
  );
}
