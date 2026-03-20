"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { SlidersHorizontal, Check, Save, Loader2, Zap } from "lucide-react";

const ROLES = [
  "HHA (Caregiver)", "CNA", "LPN", "RN (Staff Nurse)", "APRN",
  "Senior Staff Nurse", "Nurse Incharge", "Nurse Manager",
  "Head of Nursing Services", "Director of Nursing",
  "Executive Leadership", "Student", "Other",
];

const BUSINESS_UNITS = [
  "Home Care", "In-Home Day Care", "Adult Day Care", "Assisted Living",
  "Rehab Center", "Hospitals", "Clinics", "Urgent Cares", "FSE Clinics",
  "Nursing Homes", "Hospitals - Acute Care", "Hospitals - Critical Access", "LTC/SNF",
];

const JOB_TYPES = [
  "Full-time", "Part-time", "Contract", "Temporary",
  "Volunteer", "Internship", "PRN", "Travel", "Per Diem", "Other",
];

const SHIFTS = ["Weekday", "Weekends", "Night", "Day"];

function CheckboxGroup({
  label, options, selected, onChange,
}: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt]);

  return (
    <div>
      <p className="mb-2.5 text-sm font-semibold text-[#1a2b3c]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const checked = selected.includes(opt);
          return (
            <button key={opt} type="button" onClick={() => toggle(opt)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all
                ${checked
                  ? "border-[#0090d9] bg-[#e8f4fd] text-[#0090d9]"
                  : "border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#0090d9]/40 hover:text-[#0090d9]"
                }`}
            >
              {checked && <Check className="h-3 w-3" />}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PreferencesPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState({ roles: [] as string[], businessUnits: [] as string[], jobTypes: [] as string[], shifts: [] as string[] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoApplying, setAutoApplying] = useState(false);

  useEffect(() => {
    fetch("/api/preferences")
      .then(r => r.json())
      .then(d => {
        if (d.preferences) setPrefs(d.preferences);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleAutoApply() {
    setAutoApplying(true);
    // Save preferences first, then hand off to job board for the animation
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    router.push("/job-board?autoApply=true");
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-[#0090d9]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-[#0090d9]" />
            <h1 className="text-xl font-bold text-[#1a2b3c]">Job Preferences</h1>
          </div>
          <p className="mt-1 text-sm text-[#64748b]">Tell us what you&apos;re looking for — we&apos;ll match you with the right roles.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoApply}
            disabled={autoApplying || saving}
            className="flex items-center gap-2 rounded-lg border border-[#0090d9] bg-white px-4 py-2 text-sm font-semibold text-[#0090d9] hover:bg-[#e8f4fd] disabled:opacity-60 transition-colors"
          >
            {autoApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {autoApplying ? "Applying…" : "Auto-Apply to Matching Jobs"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-[#0090d9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0077b6] disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : saved ? "Saved!" : "Save preferences"}
          </button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="card p-5 space-y-5"
      >
        <CheckboxGroup label="Which role are you interested in?" options={ROLES} selected={prefs.roles} onChange={v => setPrefs(p => ({ ...p, roles: v }))} />
        <div className="border-t border-[#f1f5f9]" />
        <CheckboxGroup label="Which business units are you interested in?" options={BUSINESS_UNITS} selected={prefs.businessUnits} onChange={v => setPrefs(p => ({ ...p, businessUnits: v }))} />
        <div className="border-t border-[#f1f5f9]" />
        <CheckboxGroup label="What type of job are you interested in?" options={JOB_TYPES} selected={prefs.jobTypes} onChange={v => setPrefs(p => ({ ...p, jobTypes: v }))} />
        <div className="border-t border-[#f1f5f9]" />
        <CheckboxGroup label="What type of shift are you interested in?" options={SHIFTS} selected={prefs.shifts} onChange={v => setPrefs(p => ({ ...p, shifts: v }))} />
      </motion.div>

      {saved && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-700">
          <Check className="h-4 w-4" />
          Preferences saved successfully.
        </motion.div>
      )}

    </div>
  );
}
