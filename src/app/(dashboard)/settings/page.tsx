"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings2,
  User,
  BarChart3,
  Loader2,
  Save,
  Check,
  AlertCircle,
  Zap,
  DollarSign,
  Clock,
  Activity,
  Gauge,
  TrendingUp,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────

interface SettingsData {
  timezone: string;
  defaultDuration: number;
  videoPlatform: string;
  videoLink: string | null;
  aiProvider: string;
  groqModel: string | null;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  monthlyBudgetCents: number;
}

interface UsageData {
  period: { days: number; since: string };
  totals: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costCents: number;
    errors: number;
    avgDurationMs: number;
  };
  today: { requests: number; costCents: number };
  thisMinute: { requests: number };
  thisMonth: { requests: number; tokens: number; costCents: number };
  rateLimits: { perMinute: number; perDay: number; monthlyBudgetCents: number };
  byProvider: Record<string, { requests: number; tokens: number; costCents: number }>;
  byModel: Record<string, { requests: number; tokens: number; costCents: number }>;
  byEndpoint: Record<string, { requests: number; tokens: number; costCents: number }>;
  daily: { date: string; requests: number; tokens: number; costCents: number }[];
  recentLogs: {
    id: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costCents: number;
    durationMs: number;
    endpoint: string | null;
    success: boolean;
    errorMessage: string | null;
    createdAt: string;
  }[];
}

type Tab = "general" | "account" | "usage";

const tabs: { id: Tab; label: string; icon: typeof Settings2 }[] = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "account", label: "Account", icon: User },
  { id: "usage", label: "Usage", icon: BarChart3 },
];

// ─── Helpers ────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function formatCents(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

function formatMs(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(1) + "s";
  return ms + "ms";
}

// ─── Page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("general");

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[#1a2b3c]">Settings</h1>
        <p className="text-sm text-[#5a6b7c]">Manage your platform preferences and usage</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <div className="w-48 shrink-0">
          <nav className="space-y-0.5">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] transition-all duration-150 text-left",
                    isActive
                      ? "text-[#1a2b3c] font-semibold bg-white shadow-sm"
                      : "text-[#5a6b7c] hover:bg-black/5 hover:text-[#1a2b3c]"
                  )}
                >
                  <tab.icon
                    className={cn(
                      "h-4 w-4 flex-shrink-0 transition-colors duration-150",
                      isActive ? "text-[#0090d9]" : "text-current"
                    )}
                  />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "general" && <GeneralTab />}
              {activeTab === "account" && <AccountTab />}
              {activeTab === "usage" && <UsageTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── General Tab ────────────────────────────────────────────────

function GeneralTab() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setSettings({
        timezone: d.timezone ?? "America/New_York",
        defaultDuration: d.defaultDuration ?? 60,
        videoPlatform: d.videoPlatform ?? "jitsi",
        videoLink: d.videoLink ?? null,
        aiProvider: d.aiProvider ?? "anthropic",
        groqModel: d.groqModel ?? null,
        rateLimitPerMinute: d.rateLimitPerMinute ?? 30,
        rateLimitPerDay: d.rateLimitPerDay ?? 1000,
        monthlyBudgetCents: d.monthlyBudgetCents ?? 5000,
      }))
      .catch(() => setError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [settings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[#0090d9]" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* Platform */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-[#1a2b3c] mb-4">Platform</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-[#5a6b7c]">Timezone</span>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1a2b3c] focus:border-[#0090d9] focus:outline-none focus:ring-1 focus:ring-[#0090d9]"
            >
              <option value="America/New_York">Eastern (ET)</option>
              <option value="America/Chicago">Central (CT)</option>
              <option value="America/Denver">Mountain (MT)</option>
              <option value="America/Los_Angeles">Pacific (PT)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#5a6b7c]">Default interview duration</span>
            <select
              value={settings.defaultDuration}
              onChange={(e) => setSettings({ ...settings, defaultDuration: Number(e.target.value) })}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1a2b3c] focus:border-[#0090d9] focus:outline-none focus:ring-1 focus:ring-[#0090d9]"
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#5a6b7c]">Video platform</span>
            <select
              value={settings.videoPlatform}
              onChange={(e) => setSettings({ ...settings, videoPlatform: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1a2b3c] focus:border-[#0090d9] focus:outline-none focus:ring-1 focus:ring-[#0090d9]"
            >
              <option value="jitsi">Jitsi (Free)</option>
              <option value="zoom">Zoom</option>
              <option value="google_meet">Google Meet</option>
              <option value="ms_teams">Microsoft Teams</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#5a6b7c]">Custom meeting link</span>
            <input
              type="text"
              value={settings.videoLink || ""}
              onChange={(e) => setSettings({ ...settings, videoLink: e.target.value || null })}
              placeholder="https://zoom.us/j/..."
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1a2b3c] placeholder:text-gray-400 focus:border-[#0090d9] focus:outline-none focus:ring-1 focus:ring-[#0090d9]"
            />
          </label>
        </div>
      </div>

      {/* AI Provider */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-[#1a2b3c] mb-4">AI Provider</h2>
        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          <button
            type="button"
            onClick={() => setSettings({ ...settings, aiProvider: "anthropic" })}
            className={cn(
              "flex items-center gap-3 rounded-lg border-2 p-4 transition-all duration-150 text-left",
              settings.aiProvider === "anthropic"
                ? "border-[#0090d9] bg-blue-50/50 shadow-sm"
                : "border-gray-200 hover:border-gray-300 bg-white"
            )}
          >
            <Image src="/Claude_AI_symbol.svg" alt="Claude" width={32} height={32} className="rounded-lg" />
            <div>
              <p className="text-sm font-semibold text-[#1a2b3c]">Anthropic</p>
              <p className="text-[11px] text-[#5a6b7c]">Claude Sonnet / Haiku</p>
            </div>
            {settings.aiProvider === "anthropic" && (
              <div className="ml-auto h-2.5 w-2.5 rounded-full bg-[#0090d9]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setSettings({ ...settings, aiProvider: "groq" })}
            className={cn(
              "flex items-center gap-3 rounded-lg border-2 p-4 transition-all duration-150 text-left",
              settings.aiProvider === "groq"
                ? "border-[#0090d9] bg-blue-50/50 shadow-sm"
                : "border-gray-200 hover:border-gray-300 bg-white"
            )}
          >
            <Image src="/groq.jpg" alt="Groq" width={32} height={32} className="rounded-lg" />
            <div>
              <p className="text-sm font-semibold text-[#1a2b3c]">Groq</p>
              <p className="text-[11px] text-[#5a6b7c]">Llama / Mixtral</p>
            </div>
            {settings.aiProvider === "groq" && (
              <div className="ml-auto h-2.5 w-2.5 rounded-full bg-[#0090d9]" />
            )}
          </button>
        </div>
        {settings.aiProvider === "groq" && (
          <label className="block max-w-xs">
            <span className="text-xs font-medium text-[#5a6b7c]">Groq model</span>
            <select
              value={settings.groqModel || ""}
              onChange={(e) => setSettings({ ...settings, groqModel: e.target.value || null })}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1a2b3c] focus:border-[#0090d9] focus:outline-none focus:ring-1 focus:ring-[#0090d9]"
            >
              <option value="">Default (Llama 3.3 70B)</option>
              <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
              <option value="llama-3.1-70b-versatile">Llama 3.1 70B</option>
              <option value="llama-3.1-8b-instant">Llama 3.1 8B (Fast)</option>
              <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
              <option value="gemma2-9b-it">Gemma 2 9B</option>
            </select>
          </label>
        )}
      </div>

      {/* Rate Limits */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-[#1a2b3c] mb-1">Rate Limits</h2>
        <p className="text-xs text-[#5a6b7c] mb-4">Control how much the AI agent can be used</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-[#5a6b7c]">Requests per minute</span>
            <input
              type="number"
              min={1}
              max={300}
              value={settings.rateLimitPerMinute}
              onChange={(e) => setSettings({ ...settings, rateLimitPerMinute: Number(e.target.value) })}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1a2b3c] focus:border-[#0090d9] focus:outline-none focus:ring-1 focus:ring-[#0090d9]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#5a6b7c]">Requests per day</span>
            <input
              type="number"
              min={1}
              max={100000}
              value={settings.rateLimitPerDay}
              onChange={(e) => setSettings({ ...settings, rateLimitPerDay: Number(e.target.value) })}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1a2b3c] focus:border-[#0090d9] focus:outline-none focus:ring-1 focus:ring-[#0090d9]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#5a6b7c]">Monthly budget</span>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <input
                type="number"
                min={0}
                max={10000}
                value={settings.monthlyBudgetCents / 100}
                onChange={(e) => setSettings({ ...settings, monthlyBudgetCents: Math.round(Number(e.target.value) * 100) })}
                className="block w-full rounded-lg border border-gray-200 bg-white pl-7 pr-3 py-2 text-sm text-[#1a2b3c] focus:border-[#0090d9] focus:outline-none focus:ring-1 focus:ring-[#0090d9]"
              />
            </div>
          </label>
        </div>
      </div>

      {/* Save */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className={cn(
            "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-all duration-150",
            saved
              ? "bg-emerald-500"
              : "bg-[#0090d9] hover:bg-[#007bbd] active:scale-[0.98]"
          )}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Account Tab ────────────────────────────────────────────────

function AccountTab() {
  const { user } = useUser();

  if (!user) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[#0090d9]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-[#1a2b3c] mb-4">Profile</h2>
        <div className="flex items-start gap-4">
          {user.imageUrl ? (
            <Image
              src={user.imageUrl}
              alt={user.fullName || "User"}
              width={56}
              height={56}
              className="rounded-full ring-4 ring-blue-100"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0090d9] text-xl font-bold text-white ring-4 ring-blue-100">
              {user.firstName?.charAt(0).toUpperCase() || "U"}
            </div>
          )}
          <div className="flex-1 grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-xs font-medium text-[#5a6b7c]">Full name</span>
              <p className="mt-0.5 text-sm font-medium text-[#1a2b3c]">
                {user.fullName || "Not set"}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-[#5a6b7c]">Email</span>
              <p className="mt-0.5 text-sm font-medium text-[#1a2b3c]">
                {user.primaryEmailAddress?.emailAddress || "Not set"}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-[#5a6b7c]">User ID</span>
              <p className="mt-0.5 text-xs font-mono text-[#5a6b7c]">{user.id}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-[#5a6b7c]">Joined</span>
              <p className="mt-0.5 text-sm font-medium text-[#1a2b3c]">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Unknown"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Auth provider */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-[#1a2b3c] mb-4">Authentication</h2>
        <div className="space-y-3">
          {user.externalAccounts?.map((acc) => {
            const providerIcon: Record<string, string> = {
              google: "/google.png",
              oauth_google: "/google.png",
            };
            const iconSrc = providerIcon[acc.provider] || providerIcon["oauth_" + acc.provider];
            return (
              <div key={acc.id} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
                {iconSrc ? (
                  <Image src={iconSrc} alt={acc.provider} width={32} height={32} className="rounded-full" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                    <User className="h-4 w-4 text-[#5a6b7c]" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-[#1a2b3c] capitalize">
                    {acc.provider.replace("oauth_", "")}
                  </p>
                  <p className="text-xs text-[#5a6b7c]">{acc.emailAddress}</p>
                </div>
                <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Connected
                </span>
              </div>
            );
          })}
          {(!user.externalAccounts || user.externalAccounts.length === 0) && (
            <p className="text-sm text-[#5a6b7c]">No external accounts connected</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Usage Tab ──────────────────────────────────────────────────

function UsageTab() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/settings/usage?days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error || !d.rateLimits) {
          setUsage(null);
        } else {
          setUsage(d);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[#0090d9]" />
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        <p>No usage data available yet.</p>
        <p className="mt-1 text-xs text-gray-400">Usage tracking starts automatically when AI calls are made. If you just added the Groq/AI provider, restart the dev server after running <code className="bg-gray-100 px-1 rounded">npx prisma generate</code>.</p>
      </div>
    );
  }

  const limits = usage.rateLimits ?? { monthlyBudgetCents: 5000, perDay: 1000, perMinute: 30 };
  const budgetPct = limits.monthlyBudgetCents > 0
    ? Math.min(100, (usage.thisMonth.costCents / limits.monthlyBudgetCents) * 100)
    : 0;
  const dailyPct = limits.perDay > 0
    ? Math.min(100, (usage.today.requests / limits.perDay) * 100)
    : 0;
  const minutePct = limits.perMinute > 0
    ? Math.min(100, (usage.thisMinute.requests / limits.perMinute) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Period picker */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#1a2b3c]">AI Usage</h2>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-[#1a2b3c] focus:border-[#0090d9] focus:outline-none"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Rate limit gauges */}
      <div className="grid gap-3 sm:grid-cols-3">
        <RateLimitGauge
          label="This minute"
          current={usage.thisMinute.requests}
          limit={limits.perMinute}
          pct={minutePct}
          icon={Gauge}
          unit="req"
        />
        <RateLimitGauge
          label="Today"
          current={usage.today.requests}
          limit={limits.perDay}
          pct={dailyPct}
          icon={Activity}
          unit="req"
        />
        <RateLimitGauge
          label="Monthly budget"
          current={usage.thisMonth.costCents}
          limit={limits.monthlyBudgetCents}
          pct={budgetPct}
          icon={DollarSign}
          unit="cents"
          formatValue={(v) => formatCents(v)}
          formatLimit={(v) => formatCents(v)}
        />
      </div>

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard icon={Zap} label="Total requests" value={usage.totals.requests.toLocaleString()} />
        <StatCard icon={TrendingUp} label="Total tokens" value={formatTokens(usage.totals.totalTokens)} />
        <StatCard icon={DollarSign} label="Total cost" value={formatCents(usage.totals.costCents)} />
        <StatCard icon={Clock} label="Avg latency" value={formatMs(usage.totals.avgDurationMs)} />
      </div>

      {/* Daily chart */}
      {usage.daily.length > 0 && (
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-[#1a2b3c] mb-3">Daily Usage</h3>
          <div className="h-32 flex items-end gap-1">
            {usage.daily.map((d) => {
              const maxReq = Math.max(...usage.daily.map((x) => x.requests), 1);
              const height = Math.max(4, (d.requests / maxReq) * 100);
              return (
                <div key={d.date} className="flex-1 group relative">
                  <div
                    className="w-full rounded-t bg-[#0090d9]/80 hover:bg-[#0090d9] transition-colors cursor-default"
                    style={{ height: `${height}%` }}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                    <div className="rounded bg-[#1a2b3c] px-2 py-1 text-[10px] text-white whitespace-nowrap shadow">
                      {d.date.slice(5)}: {d.requests} req, {formatCents(d.costCents)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[#5a6b7c]">
            <span>{usage.daily[0]?.date.slice(5)}</span>
            <span>{usage.daily[usage.daily.length - 1]?.date.slice(5)}</span>
          </div>
        </div>
      )}

      {/* Breakdown cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* By provider */}
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-[#1a2b3c] mb-3">By Provider</h3>
          {Object.keys(usage.byProvider).length === 0 ? (
            <p className="text-xs text-[#5a6b7c]">No data yet</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(usage.byProvider).map(([provider, data]) => (
                <div key={provider} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <CircleDot className="h-3 w-3 text-[#0090d9]" />
                    <span className="font-medium text-[#1a2b3c] capitalize">{provider}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#5a6b7c]">
                    <span>{data.requests} req</span>
                    <span>{formatTokens(data.tokens)} tok</span>
                    <span className="font-medium text-[#1a2b3c]">{formatCents(data.costCents)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By model */}
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-[#1a2b3c] mb-3">By Model</h3>
          {Object.keys(usage.byModel).length === 0 ? (
            <p className="text-xs text-[#5a6b7c]">No data yet</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(usage.byModel).map(([model, data]) => (
                <div key={model} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-[#1a2b3c] text-xs truncate max-w-[180px]">{model}</span>
                  <div className="flex items-center gap-4 text-xs text-[#5a6b7c]">
                    <span>{data.requests} req</span>
                    <span className="font-medium text-[#1a2b3c]">{formatCents(data.costCents)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* By endpoint */}
      <div className="card p-5">
        <h3 className="text-xs font-semibold text-[#1a2b3c] mb-3">By Feature</h3>
        {Object.keys(usage.byEndpoint).length === 0 ? (
          <p className="text-xs text-[#5a6b7c]">No data yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[#5a6b7c]">
                  <th className="pb-2 font-medium">Feature</th>
                  <th className="pb-2 font-medium text-right">Requests</th>
                  <th className="pb-2 font-medium text-right">Tokens</th>
                  <th className="pb-2 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(usage.byEndpoint)
                  .sort(([, a], [, b]) => b.costCents - a.costCents)
                  .map(([endpoint, data]) => (
                    <tr key={endpoint} className="border-b border-gray-50">
                      <td className="py-2 font-medium text-[#1a2b3c] capitalize">{endpoint}</td>
                      <td className="py-2 text-right text-[#5a6b7c]">{data.requests}</td>
                      <td className="py-2 text-right text-[#5a6b7c]">{formatTokens(data.tokens)}</td>
                      <td className="py-2 text-right font-medium text-[#1a2b3c]">{formatCents(data.costCents)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent logs */}
      <div className="card p-5">
        <h3 className="text-xs font-semibold text-[#1a2b3c] mb-3">Recent Requests</h3>
        {usage.recentLogs.length === 0 ? (
          <p className="text-xs text-[#5a6b7c]">No requests yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[#5a6b7c]">
                  <th className="pb-2 font-medium">Time</th>
                  <th className="pb-2 font-medium">Provider</th>
                  <th className="pb-2 font-medium">Model</th>
                  <th className="pb-2 font-medium">Feature</th>
                  <th className="pb-2 font-medium text-right">Tokens</th>
                  <th className="pb-2 font-medium text-right">Cost</th>
                  <th className="pb-2 font-medium text-right">Latency</th>
                  <th className="pb-2 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {usage.recentLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50">
                    <td className="py-2 text-[#5a6b7c] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-2 capitalize text-[#1a2b3c]">{log.provider}</td>
                    <td className="py-2 text-[#5a6b7c] truncate max-w-[140px]">{log.model}</td>
                    <td className="py-2 capitalize text-[#1a2b3c]">{log.endpoint || "—"}</td>
                    <td className="py-2 text-right text-[#5a6b7c]">
                      <span className="text-emerald-600">{formatTokens(log.inputTokens)}</span>
                      {" / "}
                      <span className="text-blue-600">{formatTokens(log.outputTokens)}</span>
                    </td>
                    <td className="py-2 text-right font-medium text-[#1a2b3c]">{formatCents(log.costCents)}</td>
                    <td className="py-2 text-right text-[#5a6b7c]">{formatMs(log.durationMs)}</td>
                    <td className="py-2 text-center">
                      {log.success ? (
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                      ) : (
                        <span className="inline-block h-2 w-2 rounded-full bg-red-400" title={log.errorMessage || "Error"} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reusable components ────────────────────────────────────────

function StatCard({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-[#0090d9]" />
        <span className="text-[11px] text-[#5a6b7c]">{label}</span>
      </div>
      <p className="text-lg font-bold text-[#1a2b3c]">{value}</p>
    </div>
  );
}

function RateLimitGauge({
  label,
  current,
  limit,
  pct,
  icon: Icon,
  unit,
  formatValue,
  formatLimit,
}: {
  label: string;
  current: number;
  limit: number;
  pct: number;
  icon: typeof Gauge;
  unit: string;
  formatValue?: (v: number) => string;
  formatLimit?: (v: number) => string;
}) {
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";
  const fmtCurrent = formatValue ? formatValue(current) : current.toString();
  const fmtLimit = formatLimit ? formatLimit(limit) : limit.toString();

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-[#5a6b7c]" />
        <span className="text-[11px] text-[#5a6b7c]">{label}</span>
      </div>
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-base font-bold text-[#1a2b3c]">{fmtCurrent}</span>
        <span className="text-[11px] text-[#5a6b7c]">/ {fmtLimit} {unit !== "cents" ? unit : ""}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={cn("h-full rounded-full", color)}
        />
      </div>
    </div>
  );
}
