"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, Check, ChevronRight, ChevronLeft,
  Loader2, Sparkles, X, AlertCircle, PartyPopper,
} from "lucide-react";

// ─── Preference data ─────────────────────────────────────────
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

// ─── Types ───────────────────────────────────────────────────
interface ParsedProfile {
  headline?: string;
  summary?: string;
  phone?: string;
  city?: string;
  state?: string;
  experiences?: Array<{
    title: string; company: string; description?: string;
    startDate: string; endDate?: string; current: boolean;
  }>;
  educations?: Array<{
    school: string; degree?: string; field?: string;
    startDate?: string; endDate?: string;
  }>;
  skills?: string[];
  certifications?: Array<{
    name: string; issuer?: string; issueDate?: string; expiryDate?: string;
  }>;
}

interface Preferences {
  roles: string[];
  businessUnits: string[];
  jobTypes: string[];
  shifts: string[];
}

// ─── Step indicator ──────────────────────────────────────────
function StepDot({ step, current, label }: { step: number; current: number; label: string }) {
  const done = step < current;
  const active = step === current;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300
        ${done ? "bg-[#0090d9] text-white" : active ? "bg-[#0090d9] text-white ring-4 ring-[#0090d9]/20" : "bg-white border-2 border-[#d1d5db] text-[#9ca3af]"}`}>
        {done ? <Check className="h-4 w-4" /> : step}
      </div>
      <span className={`text-xs font-medium ${active ? "text-[#0090d9]" : done ? "text-[#64748b]" : "text-[#9ca3af]"}`}>
        {label}
      </span>
    </div>
  );
}

function StepLine({ done }: { done: boolean }) {
  return (
    <div className="mx-2 mt-[-12px] h-0.5 w-12 flex-1 rounded-full transition-all duration-500"
      style={{ background: done ? "#0090d9" : "#e5e7eb" }} />
  );
}

// ─── Checkbox group ──────────────────────────────────────────
function CheckboxGroup({
  label, options, selected, onChange,
}: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt]);
  };
  return (
    <div>
      <p className="mb-2.5 text-sm font-semibold text-[#1a2b3c]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const checked = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
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

// ─── Main page ───────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const [step, setStep] = useState(1);

  // Step 1 — Resume
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedProfile | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 2 — Preferences
  const [prefs, setPrefs] = useState<Preferences>({
    roles: [], businessUnits: [], jobTypes: [], shifts: [],
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  // ── File handlers ──────────────────────────────────────────
  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setParsed(null);
    setParseError(null);
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("resume", f);
      const res = await fetch("/api/profile/parse-resume", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Parse failed");
      setParsed(data.profile);
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : "Could not parse resume");
    } finally {
      setParsing(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // ── Save profile from parsed resume ───────────────────────
  async function saveProfile() {
    if (!parsed) { setStep(2); return; }
    setSaving(true);
    try {
      // Save headline/summary/location via existing profile API
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: parsed.headline,
          summary: parsed.summary,
          phone: parsed.phone,
          city: parsed.city,
          state: parsed.state,
        }),
      });

      // Save experiences
      for (const exp of parsed.experiences ?? []) {
        await fetch("/api/profile/experience", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(exp),
        });
      }
      // Save educations
      for (const edu of parsed.educations ?? []) {
        await fetch("/api/profile/education", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(edu),
        });
      }
      // Save skills
      for (const skill of parsed.skills ?? []) {
        await fetch("/api/profile/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: skill }),
        });
      }
      // Save certifications
      for (const cert of parsed.certifications ?? []) {
        await fetch("/api/profile/certifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cert),
        });
      }
    } catch (err) {
      console.error("Error saving profile:", err);
    } finally {
      setSaving(false);
      setStep(2);
    }
  }

  // ── Save preferences ───────────────────────────────────────
  async function savePreferences() {
    setSavingPrefs(true);
    try {
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      setStep(3);
    } catch (err) {
      console.error("Error saving preferences:", err);
    } finally {
      setSavingPrefs(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-black/5 bg-white px-6">
        <div className="flex items-center gap-2.5">
          <Image src="/careslink.png" alt="CaresLink" width={28} height={28} className="rounded-md" />
          <span className="text-base font-bold text-[#0090d9]">CaresLink</span>
        </div>
        <span className="text-sm text-[#94a3b8]">
          Welcome{user?.firstName ? `, ${user.firstName}` : ""}
        </span>
      </header>

      {/* Progress */}
      <div className="flex items-center justify-center gap-0 py-6">
        <StepDot step={1} current={step} label="Resume" />
        <StepLine done={step > 1} />
        <StepDot step={2} current={step} label="Preferences" />
        <StepLine done={step > 2} />
        <StepDot step={3} current={step} label="Done" />
      </div>

      {/* Content */}
      <div className="flex flex-1 items-start justify-center px-4 pb-12">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">

            {/* ── Step 1: Upload Resume ─────────────────────── */}
            {step === 1 && (
              <motion.div key="step1"
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-[#1a2b3c]">Upload your resume</h1>
                  <p className="mt-1.5 text-sm text-[#64748b]">
                    We&apos;ll instantly parse it and auto-fill your profile — no manual typing needed.
                  </p>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 transition-all
                    ${dragging ? "border-[#0090d9] bg-[#e8f4fd]" : file ? "border-[#10b981] bg-[#f0fdf4]" : "border-[#d1d5db] bg-white hover:border-[#0090d9]/50 hover:bg-[#f8fbff]"}`}
                >
                  <input
                    ref={fileRef} type="file" className="hidden"
                    accept=".pdf,.docx,.doc,.txt"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />

                  {parsing ? (
                    <>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f4fd]">
                        <Loader2 className="h-7 w-7 animate-spin text-[#0090d9]" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-[#0090d9]">Analyzing with AI...</p>
                        <p className="text-xs text-[#64748b]">Extracting your experience, skills & certifications</p>
                      </div>
                    </>
                  ) : file && parsed ? (
                    <>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dcfce7]">
                        <Check className="h-7 w-7 text-[#10b981]" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-[#1a2b3c]">{file.name}</p>
                        <p className="text-xs text-[#10b981] font-medium">Resume parsed successfully</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f1f5f9]">
                        <Upload className="h-7 w-7 text-[#94a3b8]" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-[#334155]">
                          {dragging ? "Drop it here!" : "Drag & drop your resume"}
                        </p>
                        <p className="text-xs text-[#94a3b8]">or click to browse — PDF, DOCX, TXT</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Parse error */}
                {parseError && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {parseError}
                  </div>
                )}

                {/* Parsed preview */}
                {parsed && !parsing && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-[#e2e8f0] bg-white p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[#0090d9]" />
                        <span className="text-sm font-semibold text-[#1a2b3c]">AI extracted from your resume</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setFile(null); setParsed(null); }}
                        className="text-[#94a3b8] hover:text-[#64748b]">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {parsed.headline && (
                        <div className="col-span-2 rounded-lg bg-[#f8fafc] p-2.5">
                          <p className="text-[#94a3b8] font-medium mb-0.5">Headline</p>
                          <p className="text-[#334155]">{parsed.headline}</p>
                        </div>
                      )}
                      {(parsed.city || parsed.state) && (
                        <div className="rounded-lg bg-[#f8fafc] p-2.5">
                          <p className="text-[#94a3b8] font-medium mb-0.5">Location</p>
                          <p className="text-[#334155]">{[parsed.city, parsed.state].filter(Boolean).join(", ")}</p>
                        </div>
                      )}
                      {parsed.phone && (
                        <div className="rounded-lg bg-[#f8fafc] p-2.5">
                          <p className="text-[#94a3b8] font-medium mb-0.5">Phone</p>
                          <p className="text-[#334155]">{parsed.phone}</p>
                        </div>
                      )}
                      {(parsed.experiences?.length ?? 0) > 0 && (
                        <div className="rounded-lg bg-[#f8fafc] p-2.5">
                          <p className="text-[#94a3b8] font-medium mb-0.5">Experience</p>
                          <p className="text-[#334155]">{parsed.experiences!.length} position{parsed.experiences!.length !== 1 ? "s" : ""} found</p>
                        </div>
                      )}
                      {(parsed.skills?.length ?? 0) > 0 && (
                        <div className="rounded-lg bg-[#f8fafc] p-2.5">
                          <p className="text-[#94a3b8] font-medium mb-0.5">Skills</p>
                          <p className="text-[#334155]">{parsed.skills!.length} skills found</p>
                        </div>
                      )}
                      {(parsed.certifications?.length ?? 0) > 0 && (
                        <div className="col-span-2 rounded-lg bg-[#f8fafc] p-2.5">
                          <p className="text-[#94a3b8] font-medium mb-0.5">Certifications</p>
                          <p className="text-[#334155]">{parsed.certifications!.map(c => c.name).join(", ")}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 rounded-xl border border-[#e2e8f0] bg-white py-3 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors"
                  >
                    Skip for now
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={saving || parsing}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0090d9] py-3 text-sm font-semibold text-white hover:bg-[#0077b6] disabled:opacity-60 transition-colors"
                  >
                    {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <>Continue <ChevronRight className="h-4 w-4" /></>}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Job Preferences ───────────────────── */}
            {step === 2 && (
              <motion.div key="step2"
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-[#1a2b3c]">What are you looking for?</h1>
                  <p className="mt-1.5 text-sm text-[#64748b]">
                    Select your preferences so we can match you with the right opportunities.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 space-y-5">
                  <CheckboxGroup
                    label="Which role are you interested in?"
                    options={ROLES}
                    selected={prefs.roles}
                    onChange={v => setPrefs(p => ({ ...p, roles: v }))}
                  />
                  <div className="border-t border-[#f1f5f9]" />
                  <CheckboxGroup
                    label="Which business units are you interested in?"
                    options={BUSINESS_UNITS}
                    selected={prefs.businessUnits}
                    onChange={v => setPrefs(p => ({ ...p, businessUnits: v }))}
                  />
                  <div className="border-t border-[#f1f5f9]" />
                  <CheckboxGroup
                    label="What type of job are you interested in?"
                    options={JOB_TYPES}
                    selected={prefs.jobTypes}
                    onChange={v => setPrefs(p => ({ ...p, jobTypes: v }))}
                  />
                  <div className="border-t border-[#f1f5f9]" />
                  <CheckboxGroup
                    label="What type of shift are you interested in?"
                    options={SHIFTS}
                    selected={prefs.shifts}
                    onChange={v => setPrefs(p => ({ ...p, shifts: v }))}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-5 py-3 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="flex-1 rounded-xl border border-[#e2e8f0] bg-white py-3 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    onClick={savePreferences}
                    disabled={savingPrefs || (prefs.roles.length === 0 && prefs.jobTypes.length === 0)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0090d9] py-3 text-sm font-semibold text-white hover:bg-[#0077b6] disabled:opacity-60 transition-colors"
                  >
                    {savingPrefs ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <>Save & continue <ChevronRight className="h-4 w-4" /></>}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Done ──────────────────────────────── */}
            {step === 3 && (
              <motion.div key="step3"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
                className="flex flex-col items-center gap-5 py-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-[#e8f4fd]"
                >
                  <PartyPopper className="h-10 w-10 text-[#0090d9]" />
                </motion.div>
                <div>
                  <h1 className="text-2xl font-bold text-[#1a2b3c]">You&apos;re all set!</h1>
                  <p className="mt-2 text-sm text-[#64748b] max-w-sm">
                    Your profile is ready. We&apos;ll match you with the best opportunities based on your skills and preferences.
                  </p>
                </div>

                <div className="w-full max-w-xs space-y-2.5">
                  <button
                    onClick={() => router.push("/profile")}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0090d9] py-3 text-sm font-semibold text-white hover:bg-[#0077b6] transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    View my profile
                  </button>
                  <button
                    onClick={() => router.push("/")}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#e2e8f0] bg-white py-3 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors"
                  >
                    Go to dashboard
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
