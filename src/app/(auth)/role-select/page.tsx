"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { Briefcase, UserSearch } from "lucide-react";

export default function RoleSelectPage() {
  const router = useRouter();
  const { user } = useUser();
  const [selected, setSelected] = useState<"EMPLOYER" | "CANDIDATE" | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (!selected) return;
    setLoading(true);

    const res = await fetch("/api/auth/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: selected }),
    });

    if (res.ok) {
      if (selected === "EMPLOYER") {
        router.push("/");
      } else {
        router.push("/onboarding");
      }
      router.refresh();
    } else {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa] p-8">
      <div className="w-full max-w-lg space-y-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <Image
            src="/careslink.png"
            alt="CaresLink"
            width={44}
            height={44}
            className="rounded-lg"
          />
          <span className="text-2xl font-bold text-[#0090d9]">CaresLink</span>
        </div>

        {/* Heading */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome{user?.firstName ? `, ${user.firstName}` : ""}!
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Choose your profile type to get started
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Employer */}
          <button
            onClick={() => setSelected("EMPLOYER")}
            className={`group relative flex flex-col items-center gap-4 rounded-xl border-2 p-8 transition-all ${
              selected === "EMPLOYER"
                ? "border-[#0090d9] bg-[#e8f4fd] shadow-md"
                : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
            }`}
          >
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full ${
                selected === "EMPLOYER"
                  ? "bg-[#0090d9] text-white"
                  : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"
              } transition-colors`}
            >
              <Briefcase className="h-7 w-7" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">Employer</h3>
              <p className="mt-1 text-xs text-gray-500">
                Recruiter or HR professional looking to hire talent
              </p>
            </div>
            {selected === "EMPLOYER" && (
              <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#0090d9] text-white">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>

          {/* Candidate */}
          <button
            onClick={() => setSelected("CANDIDATE")}
            className={`group relative flex flex-col items-center gap-4 rounded-xl border-2 p-8 transition-all ${
              selected === "CANDIDATE"
                ? "border-[#0090d9] bg-[#e8f4fd] shadow-md"
                : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
            }`}
          >
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full ${
                selected === "CANDIDATE"
                  ? "bg-[#0090d9] text-white"
                  : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"
              } transition-colors`}
            >
              <UserSearch className="h-7 w-7" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">Candidate</h3>
              <p className="mt-1 text-xs text-gray-500">
                Job seeker looking to apply for positions
              </p>
            </div>
            {selected === "CANDIDATE" && (
              <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#0090d9] text-white">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        </div>

        {/* Continue */}
        <button
          onClick={handleContinue}
          disabled={!selected || loading}
          className="w-full rounded-lg bg-[#0090d9] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0077b6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Setting up your profile..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
