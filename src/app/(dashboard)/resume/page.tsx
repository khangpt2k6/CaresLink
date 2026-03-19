"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Check, Briefcase, GraduationCap, Award,
  Wrench, MapPin, Phone, Mail, Loader2, ChevronRight, FileText,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────
interface Experience {
  id: string; title: string; company: string; description?: string;
  startDate?: string; endDate?: string; current: boolean;
}
interface Education {
  id: string; school: string; degree?: string; field?: string;
  startDate?: string; endDate?: string;
}
interface Skill { id: string; name: string; }
interface Certification { id: string; name: string; issuer?: string; issueDate?: string; expiryDate?: string; }
interface Profile {
  headline?: string; summary?: string; phone?: string; city?: string;
  state?: string; resumeTemplate?: string;
  experiences: Experience[]; educations: Education[];
  skills: Skill[]; certifications: Certification[];
}
interface User { name?: string; email: string; }

type TemplateId = "healthcare-pro" | "modern" | "classic" | "minimal";

const TEMPLATES: { id: TemplateId; label: string; accent: string; desc: string }[] = [
  { id: "healthcare-pro", label: "Healthcare Pro", accent: "#0090d9", desc: "Clean & professional" },
  { id: "modern",         label: "Modern",         accent: "#1e293b", desc: "Bold dark sidebar" },
  { id: "classic",        label: "Classic",        accent: "#374151", desc: "ATS-friendly" },
  { id: "minimal",        label: "Minimal",        accent: "#7c3aed", desc: "Elegant & airy" },
];

function fmtDate(d?: string) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" }); }
  catch { return d.slice(0, 7); }
}

// ─── Template: Healthcare Pro ────────────────────────────────
function HealthcarePro({ user, profile }: { user: User; profile: Profile }) {
  return (
    <div className="min-h-[1050px] bg-white text-[#1a2b3c] font-sans text-sm leading-relaxed">
      {/* Header */}
      <div className="bg-[#0090d9] px-10 py-8 text-white">
        <h1 className="text-3xl font-bold tracking-tight">{user.name || "Your Name"}</h1>
        {profile.headline && <p className="mt-1 text-lg text-white/80">{profile.headline}</p>}
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/70">
          {user.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{user.email}</span>}
          {profile.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{profile.phone}</span>}
          {(profile.city || profile.state) && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />{[profile.city, profile.state].filter(Boolean).join(", ")}
            </span>
          )}
        </div>
      </div>

      <div className="px-10 py-6 space-y-6">
        {profile.summary && (
          <div>
            <h2 className="mb-2 border-b-2 border-[#0090d9] pb-1 text-base font-bold uppercase tracking-wider text-[#0090d9]">Summary</h2>
            <p className="text-[#374151]">{profile.summary}</p>
          </div>
        )}

        {profile.experiences.length > 0 && (
          <div>
            <h2 className="mb-3 border-b-2 border-[#0090d9] pb-1 text-base font-bold uppercase tracking-wider text-[#0090d9]">Experience</h2>
            <div className="space-y-4">
              {profile.experiences.map((e) => (
                <div key={e.id}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-[#0f172a]">{e.title}</p>
                      <p className="text-[#0090d9] font-medium">{e.company}</p>
                    </div>
                    <p className="shrink-0 text-xs text-[#94a3b8]">
                      {fmtDate(e.startDate)} — {e.current ? "Present" : fmtDate(e.endDate)}
                    </p>
                  </div>
                  {e.description && <p className="mt-1 text-[#475569] text-xs leading-relaxed">{e.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          {profile.educations.length > 0 && (
            <div>
              <h2 className="mb-3 border-b-2 border-[#0090d9] pb-1 text-base font-bold uppercase tracking-wider text-[#0090d9]">Education</h2>
              <div className="space-y-3">
                {profile.educations.map((e) => (
                  <div key={e.id}>
                    <p className="font-semibold text-[#0f172a]">{e.school}</p>
                    {(e.degree || e.field) && <p className="text-xs text-[#475569]">{[e.degree, e.field].filter(Boolean).join(", ")}</p>}
                    {(e.startDate || e.endDate) && (
                      <p className="text-xs text-[#94a3b8]">{fmtDate(e.startDate)} — {fmtDate(e.endDate)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {profile.certifications.length > 0 && (
            <div>
              <h2 className="mb-3 border-b-2 border-[#0090d9] pb-1 text-base font-bold uppercase tracking-wider text-[#0090d9]">Certifications</h2>
              <div className="space-y-2">
                {profile.certifications.map((c) => (
                  <div key={c.id}>
                    <p className="font-semibold text-[#0f172a]">{c.name}</p>
                    {c.issuer && <p className="text-xs text-[#475569]">{c.issuer}</p>}
                    {c.expiryDate && <p className="text-xs text-[#94a3b8]">Exp: {fmtDate(c.expiryDate)}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {profile.skills.length > 0 && (
          <div>
            <h2 className="mb-3 border-b-2 border-[#0090d9] pb-1 text-base font-bold uppercase tracking-wider text-[#0090d9]">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((s) => (
                <span key={s.id} className="rounded-full bg-[#e8f4fd] px-3 py-1 text-xs font-medium text-[#0090d9]">{s.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Template: Modern ────────────────────────────────────────
function Modern({ user, profile }: { user: User; profile: Profile }) {
  return (
    <div className="min-h-[1050px] bg-white font-sans text-sm flex">
      {/* Sidebar */}
      <div className="w-64 shrink-0 bg-[#1e293b] text-white px-6 py-8 space-y-6">
        <div>
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#0090d9] text-3xl font-bold text-white">
            {(user.name || "U")[0].toUpperCase()}
          </div>
          <h1 className="text-xl font-bold leading-tight">{user.name || "Your Name"}</h1>
          {profile.headline && <p className="mt-1 text-sm text-slate-400">{profile.headline}</p>}
        </div>

        <div className="space-y-2 text-xs text-slate-300">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contact</p>
          <p className="flex items-center gap-2"><Mail className="h-3 w-3 shrink-0 text-[#0090d9]" />{user.email}</p>
          {profile.phone && <p className="flex items-center gap-2"><Phone className="h-3 w-3 shrink-0 text-[#0090d9]" />{profile.phone}</p>}
          {(profile.city || profile.state) && (
            <p className="flex items-center gap-2"><MapPin className="h-3 w-3 shrink-0 text-[#0090d9]" />{[profile.city, profile.state].filter(Boolean).join(", ")}</p>
          )}
        </div>

        {profile.skills.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Skills</p>
            <div className="space-y-1.5">
              {profile.skills.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#0090d9]" />
                  <span className="text-xs text-slate-300">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.certifications.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Certifications</p>
            <div className="space-y-2">
              {profile.certifications.map((c) => (
                <div key={c.id}>
                  <p className="text-xs font-semibold text-white">{c.name}</p>
                  {c.issuer && <p className="text-[11px] text-slate-400">{c.issuer}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main */}
      <div className="flex-1 px-8 py-8 space-y-6 text-[#1a2b3c]">
        {profile.summary && (
          <div>
            <h2 className="mb-2 text-base font-bold uppercase tracking-widest text-[#1e293b]">Profile</h2>
            <div className="h-0.5 w-10 bg-[#0090d9] mb-3" />
            <p className="text-[#475569] leading-relaxed">{profile.summary}</p>
          </div>
        )}

        {profile.experiences.length > 0 && (
          <div>
            <h2 className="mb-2 text-base font-bold uppercase tracking-widest text-[#1e293b]">Experience</h2>
            <div className="h-0.5 w-10 bg-[#0090d9] mb-3" />
            <div className="space-y-4">
              {profile.experiences.map((e) => (
                <div key={e.id} className="border-l-2 border-[#e2e8f0] pl-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-[#0f172a]">{e.title}</p>
                      <p className="text-xs font-medium text-[#0090d9]">{e.company}</p>
                    </div>
                    <p className="shrink-0 text-xs text-[#94a3b8]">
                      {fmtDate(e.startDate)} — {e.current ? "Present" : fmtDate(e.endDate)}
                    </p>
                  </div>
                  {e.description && <p className="mt-1 text-xs text-[#475569] leading-relaxed">{e.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.educations.length > 0 && (
          <div>
            <h2 className="mb-2 text-base font-bold uppercase tracking-widest text-[#1e293b]">Education</h2>
            <div className="h-0.5 w-10 bg-[#0090d9] mb-3" />
            <div className="space-y-3">
              {profile.educations.map((e) => (
                <div key={e.id}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-[#0f172a]">{e.school}</p>
                      {(e.degree || e.field) && <p className="text-xs text-[#475569]">{[e.degree, e.field].filter(Boolean).join(", ")}</p>}
                    </div>
                    {(e.startDate || e.endDate) && (
                      <p className="text-xs text-[#94a3b8]">{fmtDate(e.startDate)} — {fmtDate(e.endDate)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Template: Classic ───────────────────────────────────────
function Classic({ user, profile }: { user: User; profile: Profile }) {
  return (
    <div className="min-h-[1050px] bg-white px-12 py-10 font-serif text-sm text-[#1a1a1a] leading-relaxed">
      {/* Header */}
      <div className="border-b-2 border-[#374151] pb-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{user.name || "Your Name"}</h1>
        {profile.headline && <p className="mt-1 text-base text-[#374151]">{profile.headline}</p>}
        <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-[#6b7280]">
          {user.email && <span>{user.email}</span>}
          {profile.phone && <span>• {profile.phone}</span>}
          {(profile.city || profile.state) && <span>• {[profile.city, profile.state].filter(Boolean).join(", ")}</span>}
        </div>
      </div>

      <div className="space-y-5 pt-5">
        {profile.summary && (
          <div>
            <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-[#374151]">Objective / Summary</h2>
            <p className="text-[#374151]">{profile.summary}</p>
          </div>
        )}

        {profile.experiences.length > 0 && (
          <div>
            <h2 className="mb-2 border-b border-[#d1d5db] pb-1 text-sm font-bold uppercase tracking-widest text-[#374151]">Professional Experience</h2>
            <div className="space-y-4">
              {profile.experiences.map((e) => (
                <div key={e.id}>
                  <div className="flex items-baseline justify-between">
                    <p className="font-bold text-[#0f172a]">{e.title} — <span className="font-normal italic">{e.company}</span></p>
                    <p className="shrink-0 text-xs text-[#6b7280]">
                      {fmtDate(e.startDate)} – {e.current ? "Present" : fmtDate(e.endDate)}
                    </p>
                  </div>
                  {e.description && <p className="mt-1 text-xs text-[#374151] leading-relaxed">{e.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          {profile.educations.length > 0 && (
            <div>
              <h2 className="mb-2 border-b border-[#d1d5db] pb-1 text-sm font-bold uppercase tracking-widest text-[#374151]">Education</h2>
              <div className="space-y-2">
                {profile.educations.map((e) => (
                  <div key={e.id}>
                    <p className="font-bold">{e.school}</p>
                    {(e.degree || e.field) && <p className="text-xs italic text-[#374151]">{[e.degree, e.field].filter(Boolean).join(", ")}</p>}
                    {(e.startDate || e.endDate) && <p className="text-xs text-[#6b7280]">{fmtDate(e.startDate)} – {fmtDate(e.endDate)}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {profile.skills.length > 0 && (
            <div>
              <h2 className="mb-2 border-b border-[#d1d5db] pb-1 text-sm font-bold uppercase tracking-widest text-[#374151]">Skills</h2>
              <p className="text-xs text-[#374151] leading-relaxed">{profile.skills.map(s => s.name).join(" • ")}</p>
            </div>
          )}
        </div>

        {profile.certifications.length > 0 && (
          <div>
            <h2 className="mb-2 border-b border-[#d1d5db] pb-1 text-sm font-bold uppercase tracking-widest text-[#374151]">Licenses & Certifications</h2>
            <div className="space-y-1">
              {profile.certifications.map((c) => (
                <p key={c.id} className="text-xs text-[#374151]">
                  <span className="font-semibold">{c.name}</span>
                  {c.issuer && ` — ${c.issuer}`}
                  {c.expiryDate && ` (Exp: ${fmtDate(c.expiryDate)})`}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Template: Minimal ───────────────────────────────────────
function Minimal({ user, profile }: { user: User; profile: Profile }) {
  return (
    <div className="min-h-[1050px] bg-white px-14 py-10 font-sans text-sm text-[#18181b] leading-relaxed">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-light tracking-tight text-[#18181b]">{user.name || "Your Name"}</h1>
        {profile.headline && <p className="mt-1 text-base text-[#7c3aed] font-light">{profile.headline}</p>}
        <div className="mt-3 flex flex-wrap gap-5 text-xs text-[#71717a]">
          {user.email && <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{user.email}</span>}
          {profile.phone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{profile.phone}</span>}
          {(profile.city || profile.state) && (
            <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{[profile.city, profile.state].filter(Boolean).join(", ")}</span>
          )}
        </div>
      </div>

      <div className="space-y-7">
        {profile.summary && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#7c3aed] mb-2">About</p>
            <p className="text-[#3f3f46] leading-relaxed font-light">{profile.summary}</p>
          </div>
        )}

        {profile.experiences.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#7c3aed] mb-4">Experience</p>
            <div className="space-y-5">
              {profile.experiences.map((e) => (
                <div key={e.id} className="grid grid-cols-[1fr_auto] gap-4">
                  <div>
                    <p className="font-semibold text-[#18181b]">{e.title}</p>
                    <p className="text-xs text-[#52525b]">{e.company}</p>
                    {e.description && <p className="mt-1.5 text-xs text-[#71717a] leading-relaxed font-light">{e.description}</p>}
                  </div>
                  <p className="text-right text-xs text-[#a1a1aa] whitespace-nowrap">
                    {fmtDate(e.startDate)}<br />{e.current ? "Present" : fmtDate(e.endDate)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-8">
          {profile.educations.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#7c3aed] mb-3">Education</p>
              <div className="space-y-3">
                {profile.educations.map((e) => (
                  <div key={e.id}>
                    <p className="font-semibold text-[#18181b]">{e.school}</p>
                    {(e.degree || e.field) && <p className="text-xs text-[#71717a] font-light">{[e.degree, e.field].filter(Boolean).join(", ")}</p>}
                    {(e.startDate || e.endDate) && <p className="text-xs text-[#a1a1aa]">{fmtDate(e.startDate)} – {fmtDate(e.endDate)}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {profile.skills.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#7c3aed] mb-3">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((s) => (
                  <span key={s.id} className="rounded-sm border border-[#e4e4e7] px-2 py-0.5 text-xs text-[#52525b] font-light">{s.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {profile.certifications.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#7c3aed] mb-3">Certifications</p>
            <div className="space-y-1.5">
              {profile.certifications.map((c) => (
                <p key={c.id} className="text-xs text-[#52525b] font-light">
                  {c.name}{c.issuer && ` · ${c.issuer}`}{c.expiryDate && ` · Exp ${fmtDate(c.expiryDate)}`}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Template mini preview ────────────────────────────────────
function TemplateThumbnail({ id, active, onClick }: { id: TemplateId; active: boolean; onClick: () => void }) {
  const t = TEMPLATES.find(t => t.id === id)!;

  const preview: Record<TemplateId, React.ReactNode> = {
    "healthcare-pro": (
      <div className="h-full w-full bg-white">
        <div className="h-8 w-full" style={{ background: "#0090d9" }} />
        <div className="p-2 space-y-1.5">
          {[60, 45, 80, 55, 70].map((w, i) => (
            <div key={i} className="flex gap-1 items-center">
              <div className="h-1 rounded-full" style={{ width: `${w}%`, background: i === 0 ? "#0090d9" : "#e2e8f0" }} />
            </div>
          ))}
          <div className="flex gap-1 mt-1">
            {["#e8f4fd", "#e8f4fd", "#e8f4fd"].map((c, i) => (
              <div key={i} className="h-2 rounded-full" style={{ width: 20, background: c }} />
            ))}
          </div>
        </div>
      </div>
    ),
    "modern": (
      <div className="h-full w-full flex">
        <div className="w-[38%] h-full" style={{ background: "#1e293b" }}>
          <div className="p-2 space-y-1">
            <div className="h-6 w-6 rounded-full mx-auto mb-1" style={{ background: "#0090d9" }} />
            {[55, 70, 45, 80, 60].map((w, i) => (
              <div key={i} className="h-1 rounded-full mx-1" style={{ width: `${w}%`, background: "rgba(255,255,255,0.2)" }} />
            ))}
          </div>
        </div>
        <div className="flex-1 p-2 space-y-1.5">
          {[70, 50, 85, 45, 65].map((w, i) => (
            <div key={i} className="h-1 rounded-full" style={{ width: `${w}%`, background: "#e2e8f0" }} />
          ))}
        </div>
      </div>
    ),
    "classic": (
      <div className="h-full w-full bg-white px-2 py-2">
        <div className="border-b-2 border-[#374151] pb-1 mb-2 text-center">
          {[60, 40, 50].map((w, i) => (
            <div key={i} className="h-1 rounded-full mx-auto mb-0.5" style={{ width: `${w}%`, background: i === 0 ? "#374151" : "#d1d5db" }} />
          ))}
        </div>
        <div className="space-y-1.5">
          {[40, 70, 55, 80, 45].map((w, i) => (
            <div key={i} className="h-1 rounded-full" style={{ width: `${w}%`, background: "#d1d5db" }} />
          ))}
        </div>
      </div>
    ),
    "minimal": (
      <div className="h-full w-full bg-white px-2 py-2">
        <div className="mb-3">
          <div className="h-2 rounded-sm mb-1" style={{ width: "60%", background: "#18181b" }} />
          <div className="h-1 rounded-sm mb-2" style={{ width: "40%", background: "#7c3aed" }} />
        </div>
        <div className="space-y-1">
          {[55, 75, 45, 80, 50, 65].map((w, i) => (
            <div key={i} className="h-1 rounded-sm" style={{ width: `${w}%`, background: i % 3 === 0 ? "#7c3aed22" : "#f4f4f5" }} />
          ))}
        </div>
      </div>
    ),
  };

  return (
    <button
      onClick={onClick}
      className={`group relative rounded-xl border-2 transition-all duration-200 overflow-hidden ${
        active ? "border-[#0090d9] shadow-lg shadow-[#0090d9]/20" : "border-[#e2e8f0] hover:border-[#0090d9]/40"
      }`}
    >
      <div className="h-28 w-full">{preview[id]}</div>
      <div className={`px-3 py-2 text-left ${active ? "bg-[#e8f4fd]" : "bg-white"}`}>
        <p className={`text-xs font-semibold ${active ? "text-[#0090d9]" : "text-[#1a2b3c]"}`}>{t.label}</p>
        <p className="text-[10px] text-[#8a95a3]">{t.desc}</p>
      </div>
      {active && (
        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#0090d9]">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function ResumePage() {
  const [userData, setUserData] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [template, setTemplate] = useState<TemplateId>("healthcare-pro");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const resumeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(data => {
        setUserData(data.user);
        setProfile(data.profile ?? { experiences: [], educations: [], skills: [], certifications: [] });
        if (data.profile?.resumeTemplate) setTemplate(data.profile.resumeTemplate as TemplateId);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleTemplateChange(t: TemplateId) {
    setTemplate(t);
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeTemplate: t }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPDF() {
    if (!resumeRef.current || exporting) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const el = resumeRef.current;

      // html2canvas can't parse Tailwind v4's oklch()/oklab() color functions.
      // Strip them from all <style> tags in the cloned document before capture.
      function stripModernColors(doc: Document) {
        doc.querySelectorAll("style").forEach((s) => {
          s.textContent = (s.textContent ?? "")
            .replace(/oklch\([^)]*\)/g, (m) => {
              // Approximate lightness → hex so backgrounds/text still render
              const l = parseFloat(m.replace("oklch(", ""));
              if (l >= 0.95) return "#ffffff";
              if (l >= 0.85) return "#f1f5f9";
              if (l >= 0.70) return "#e2e8f0";
              if (l >= 0.55) return "#94a3b8";
              if (l >= 0.40) return "#64748b";
              if (l >= 0.25) return "#334155";
              return "#0f172a";
            })
            .replace(/oklab\([^)]*\)/g, "transparent");
        });
      }

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: el.scrollWidth,
        height: el.scrollHeight,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
        onclone: (_clonedDoc, clonedEl) => {
          stripModernColors(clonedEl.ownerDocument);
        },
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = 210;
      const pageH = 297;
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;

      let yPos = 0;
      let remainingH = imgH;
      let firstPage = true;

      while (remainingH > 0) {
        if (!firstPage) pdf.addPage();
        const sliceH = Math.min(pageH, remainingH);
        pdf.addImage(imgData, "JPEG", 0, -yPos, imgW, imgH);
        // Clip the page by drawing a white rectangle over the overflow
        if (remainingH > pageH) {
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, sliceH, pageW, pageH - sliceH, "F");
        }
        yPos += pageH;
        remainingH -= pageH;
        firstPage = false;
      }

      const name = userData?.name?.replace(/\s+/g, "_") ?? "Resume";
      pdf.save(`${name}_Resume.pdf`);
    } catch (e) {
      console.error("PDF export failed", e);
      alert("PDF export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#0090d9]" />
      </div>
    );
  }

  const prof = profile ?? { experiences: [], educations: [], skills: [], certifications: [] };
  const user = userData ?? { email: "" };

  const templateComponent: Record<TemplateId, React.ReactNode> = {
    "healthcare-pro": <HealthcarePro user={user} profile={prof} />,
    "modern":         <Modern user={user} profile={prof} />,
    "classic":        <Classic user={user} profile={prof} />,
    "minimal":        <Minimal user={user} profile={prof} />,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f0f4f8]">
      {/* Sidebar */}
      <div className="w-72 shrink-0 overflow-y-auto border-r border-[#e2e8f0] bg-white px-5 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#0090d9]" />
            <h1 className="text-base font-bold text-[#1a2b3c]">Resume Builder</h1>
          </div>
          <p className="mt-0.5 text-xs text-[#8a95a3]">Choose a template and export as PDF</p>
        </div>

        {/* Template grid */}
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8a95a3]">Templates</p>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {TEMPLATES.map(t => (
            <TemplateThumbnail
              key={t.id}
              id={t.id}
              active={template === t.id}
              onClick={() => handleTemplateChange(t.id)}
            />
          ))}
        </div>

        {saving && (
          <p className="mb-3 flex items-center gap-1.5 text-xs text-[#0090d9]">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving template...
          </p>
        )}

        {/* Profile summary */}
        <div className="rounded-xl border border-[#e2e8f0] p-4 space-y-2 mb-5">
          <p className="text-xs font-semibold text-[#1a2b3c]">Profile Summary</p>
          <div className="space-y-1.5 text-xs text-[#5a6b7c]">
            <div className="flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5 text-[#0090d9]" />
              <span>{prof.experiences.length} experience{prof.experiences.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-3.5 w-3.5 text-[#0090d9]" />
              <span>{prof.educations.length} education{prof.educations.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-2">
              <Wrench className="h-3.5 w-3.5 text-[#0090d9]" />
              <span>{prof.skills.length} skills</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="h-3.5 w-3.5 text-[#0090d9]" />
              <span>{prof.certifications.length} certifications</span>
            </div>
          </div>
        </div>

        {/* Download button */}
        <button
          onClick={handleDownloadPDF}
          disabled={exporting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0090d9] py-2.5 text-sm font-semibold text-white hover:bg-[#0077b6] disabled:opacity-70 transition-colors mb-2"
        >
          {exporting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating PDF…</>
          ) : (
            <><Download className="h-4 w-4" /> Download PDF</>
          )}
        </button>
        <a
          href="/profile"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#e2e8f0] py-2.5 text-sm font-medium text-[#5a6b7c] hover:bg-[#f0f4f8] transition-colors"
        >
          Edit Profile <ChevronRight className="h-4 w-4" />
        </a>
      </div>

      {/* Resume preview */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* Top bar */}
        <div className="mx-auto mb-4 flex max-w-[850px] items-center justify-between">
          <p className="text-xs text-[#8a95a3]">
            Preview — <span className="font-medium text-[#5a6b7c]">{TEMPLATES.find(t => t.id === template)?.label}</span>
          </p>
          <button
            onClick={handleDownloadPDF}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-medium text-[#1a2b3c] shadow-sm hover:bg-[#f8fafc] disabled:opacity-60 transition-colors"
          >
            {exporting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
            ) : (
              <><Download className="h-3.5 w-3.5 text-[#0090d9]" /> Download PDF</>
            )}
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={template}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mx-auto max-w-[850px] shadow-xl rounded-lg overflow-hidden"
            style={{ minHeight: 1050 }}
          >
            <div ref={resumeRef}>
              {templateComponent[template]}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
