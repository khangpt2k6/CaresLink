"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { MapPin, Phone, Mail } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────
interface Experience { id: string; title: string; company: string; description?: string; startDate?: string; endDate?: string; current: boolean; }
interface Education { id: string; school: string; degree?: string; field?: string; startDate?: string; endDate?: string; }
interface Skill { id: string; name: string; }
interface Certification { id: string; name: string; issuer?: string; expiryDate?: string; }
interface Profile {
  headline?: string; summary?: string; phone?: string; city?: string; state?: string;
  resumeTemplate?: string;
  experiences: Experience[]; educations: Education[]; skills: Skill[]; certifications: Certification[];
}
interface User { name?: string; email: string; }

type TemplateId = "healthcare-pro" | "modern" | "classic" | "minimal";

function fmtDate(d?: string) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" }); }
  catch { return d.slice(0, 7); }
}

function BulletList({ text }: { text: string }) {
  const lines = text.split("\n").filter(Boolean);
  return (
    <ul style={{ margin: "4px 0 0", padding: 0, listStyle: "none" }}>
      {lines.map((line, i) => (
        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 2 }}>
          <span style={{ marginTop: 5, width: 4, height: 4, borderRadius: "50%", background: "currentColor", opacity: 0.5, flexShrink: 0 }} />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Healthcare Pro ───────────────────────────────────────────
function HealthcarePro({ user, profile }: { user: User; profile: Profile }) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "#1a2b3c", background: "white", minHeight: "297mm" }}>
      <div style={{ background: "#0090d9", padding: "28px 40px", color: "white" }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>{user.name}</h1>
        {profile.headline && <p style={{ margin: "4px 0 0", fontSize: 14, opacity: 0.85 }}>{profile.headline}</p>}
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 16, fontSize: 11, opacity: 0.8 }}>
          {user.email && <span>✉ {user.email}</span>}
          {profile.phone && <span>✆ {profile.phone}</span>}
          {(profile.city || profile.state) && <span>⊙ {[profile.city, profile.state].filter(Boolean).join(", ")}</span>}
        </div>
      </div>
      <div style={{ padding: "24px 40px", lineHeight: 1.5 }}>
        {profile.summary && (
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#0090d9", borderBottom: "2px solid #0090d9", paddingBottom: 4 }}>Summary</h2>
            <p style={{ margin: 0, color: "#374151" }}>{profile.summary}</p>
          </div>
        )}
        {profile.experiences.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#0090d9", borderBottom: "2px solid #0090d9", paddingBottom: 4 }}>Experience</h2>
            {profile.experiences.map(e => (
              <div key={e.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>{e.title}</p>
                    <p style={{ margin: 0, color: "#0090d9", fontWeight: 600, fontSize: 11 }}>{e.company}</p>
                  </div>
                  <p style={{ margin: 0, fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap" }}>{fmtDate(e.startDate)} — {e.current ? "Present" : fmtDate(e.endDate)}</p>
                </div>
                {e.description && <div style={{ color: "#475569", fontSize: 11 }}><BulletList text={e.description} /></div>}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 20 }}>
          {profile.educations.length > 0 && (
            <div>
              <h2 style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#0090d9", borderBottom: "2px solid #0090d9", paddingBottom: 4 }}>Education</h2>
              {profile.educations.map(e => (
                <div key={e.id} style={{ marginBottom: 10 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>{e.school}</p>
                  {(e.degree || e.field) && <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>{[e.degree, e.field].filter(Boolean).join(", ")}</p>}
                  {(e.startDate || e.endDate) && <p style={{ margin: 0, fontSize: 10, color: "#94a3b8" }}>{fmtDate(e.startDate)} — {fmtDate(e.endDate)}</p>}
                </div>
              ))}
            </div>
          )}
          {profile.certifications.length > 0 && (
            <div>
              <h2 style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#0090d9", borderBottom: "2px solid #0090d9", paddingBottom: 4 }}>Certifications</h2>
              {profile.certifications.map(c => (
                <div key={c.id} style={{ marginBottom: 8 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>{c.name}</p>
                  {c.issuer && <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>{c.issuer}</p>}
                  {c.expiryDate && <p style={{ margin: 0, fontSize: 10, color: "#94a3b8" }}>Exp: {fmtDate(c.expiryDate)}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        {profile.skills.length > 0 && (
          <div>
            <h2 style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#0090d9", borderBottom: "2px solid #0090d9", paddingBottom: 4 }}>Skills</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {profile.skills.map(s => (
                <span key={s.id} style={{ background: "#e8f4fd", color: "#0090d9", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 500 }}>{s.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Classic ─────────────────────────────────────────────────
function Classic({ user, profile }: { user: User; profile: Profile }) {
  return (
    <div style={{ fontFamily: "Georgia, serif", fontSize: 12, color: "#1a1a1a", background: "white", padding: "36px 48px", minHeight: "297mm", lineHeight: 1.6 }}>
      <div style={{ borderBottom: "2px solid #374151", paddingBottom: 14, textAlign: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>{user.name}</h1>
        {profile.headline && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#374151" }}>{profile.headline}</p>}
        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, fontSize: 11, color: "#6b7280" }}>
          {user.email && <span>{user.email}</span>}
          {profile.phone && <span>• {profile.phone}</span>}
          {(profile.city || profile.state) && <span>• {[profile.city, profile.state].filter(Boolean).join(", ")}</span>}
        </div>
      </div>
      {profile.summary && (
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#374151" }}>Objective / Summary</h2>
          <p style={{ margin: 0, color: "#374151" }}>{profile.summary}</p>
        </div>
      )}
      {profile.experiences.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#374151", borderBottom: "1px solid #d1d5db", paddingBottom: 4 }}>Professional Experience</h2>
          {profile.experiences.map(e => (
            <div key={e.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{e.title} — <em style={{ fontWeight: 400 }}>{e.company}</em></p>
                <p style={{ margin: 0, fontSize: 10, color: "#6b7280", whiteSpace: "nowrap" }}>{fmtDate(e.startDate)} – {e.current ? "Present" : fmtDate(e.endDate)}</p>
              </div>
              {e.description && <div style={{ color: "#374151", fontSize: 11 }}><BulletList text={e.description} /></div>}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 18 }}>
        {profile.educations.length > 0 && (
          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#374151", borderBottom: "1px solid #d1d5db", paddingBottom: 4 }}>Education</h2>
            {profile.educations.map(e => (
              <div key={e.id} style={{ marginBottom: 8 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{e.school}</p>
                {(e.degree || e.field) && <p style={{ margin: 0, fontSize: 11, fontStyle: "italic", color: "#374151" }}>{[e.degree, e.field].filter(Boolean).join(", ")}</p>}
                {(e.startDate || e.endDate) && <p style={{ margin: 0, fontSize: 10, color: "#6b7280" }}>{fmtDate(e.startDate)} – {fmtDate(e.endDate)}</p>}
              </div>
            ))}
          </div>
        )}
        {profile.skills.length > 0 && (
          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#374151", borderBottom: "1px solid #d1d5db", paddingBottom: 4 }}>Skills</h2>
            <p style={{ margin: 0, fontSize: 11, color: "#374151", lineHeight: 1.8 }}>{profile.skills.map(s => s.name).join("  •  ")}</p>
          </div>
        )}
      </div>
      {profile.certifications.length > 0 && (
        <div>
          <h2 style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#374151", borderBottom: "1px solid #d1d5db", paddingBottom: 4 }}>Licenses & Certifications</h2>
          {profile.certifications.map(c => (
            <p key={c.id} style={{ margin: "0 0 4px", fontSize: 11, color: "#374151" }}>
              <strong>{c.name}</strong>{c.issuer && ` — ${c.issuer}`}{c.expiryDate && ` (Exp: ${fmtDate(c.expiryDate)})`}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modern ──────────────────────────────────────────────────
function Modern({ user, profile }: { user: User; profile: Profile }) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12, background: "white", display: "flex", minHeight: "297mm" }}>
      <div style={{ width: 220, flexShrink: 0, background: "#1e293b", color: "white", padding: "28px 20px" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#0090d9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, marginBottom: 12 }}>
          {(user.name || "U")[0].toUpperCase()}
        </div>
        <h1 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{user.name}</h1>
        {profile.headline && <p style={{ margin: "0 0 16px", fontSize: 11, color: "#94a3b8" }}>{profile.headline}</p>}
        <div style={{ marginBottom: 20, fontSize: 11, color: "#cbd5e1" }}>
          <p style={{ margin: "0 0 6px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#64748b" }}>Contact</p>
          <p style={{ margin: "0 0 4px" }}>✉ {user.email}</p>
          {profile.phone && <p style={{ margin: "0 0 4px" }}>✆ {profile.phone}</p>}
          {(profile.city || profile.state) && <p style={{ margin: 0 }}>⊙ {[profile.city, profile.state].filter(Boolean).join(", ")}</p>}
        </div>
        {profile.skills.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 8px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#64748b" }}>Skills</p>
            {profile.skills.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#0090d9", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "#cbd5e1" }}>{s.name}</span>
              </div>
            ))}
          </div>
        )}
        {profile.certifications.length > 0 && (
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#64748b" }}>Certifications</p>
            {profile.certifications.map(c => (
              <div key={c.id} style={{ marginBottom: 8 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "white" }}>{c.name}</p>
                {c.issuer && <p style={{ margin: 0, fontSize: 10, color: "#94a3b8" }}>{c.issuer}</p>}
                {c.expiryDate && <p style={{ margin: 0, fontSize: 10, color: "#64748b" }}>Exp: {fmtDate(c.expiryDate)}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: 1, padding: "28px 28px", color: "#1a2b3c", lineHeight: 1.5 }}>
        {profile.summary && (
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#1e293b" }}>Profile</h2>
            <div style={{ width: 32, height: 2, background: "#0090d9", marginBottom: 8 }} />
            <p style={{ margin: 0, color: "#475569" }}>{profile.summary}</p>
          </div>
        )}
        {profile.experiences.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#1e293b" }}>Experience</h2>
            <div style={{ width: 32, height: 2, background: "#0090d9", marginBottom: 8 }} />
            {profile.experiences.map(e => (
              <div key={e.id} style={{ marginBottom: 14, borderLeft: "2px solid #e2e8f0", paddingLeft: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>{e.title}</p>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#0090d9" }}>{e.company}</p>
                  </div>
                  <p style={{ margin: 0, fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap" }}>{fmtDate(e.startDate)} — {e.current ? "Present" : fmtDate(e.endDate)}</p>
                </div>
                {e.description && <div style={{ color: "#475569", fontSize: 11 }}><BulletList text={e.description} /></div>}
              </div>
            ))}
          </div>
        )}
        {profile.educations.length > 0 && (
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#1e293b" }}>Education</h2>
            <div style={{ width: 32, height: 2, background: "#0090d9", marginBottom: 8 }} />
            {profile.educations.map(e => (
              <div key={e.id} style={{ marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700 }}>{e.school}</p>
                  {(e.degree || e.field) && <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>{[e.degree, e.field].filter(Boolean).join(", ")}</p>}
                </div>
                {(e.startDate || e.endDate) && <p style={{ margin: 0, fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap" }}>{fmtDate(e.startDate)} — {fmtDate(e.endDate)}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Minimal ─────────────────────────────────────────────────
function Minimal({ user, profile }: { user: User; profile: Profile }) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "#18181b", background: "white", padding: "40px 52px", minHeight: "297mm", lineHeight: 1.6 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 300, letterSpacing: -1 }}>{user.name}</h1>
        {profile.headline && <p style={{ margin: "4px 0 0", fontSize: 14, color: "#7c3aed", fontWeight: 300 }}>{profile.headline}</p>}
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 20, fontSize: 11, color: "#71717a" }}>
          {user.email && <span>✉ {user.email}</span>}
          {profile.phone && <span>✆ {profile.phone}</span>}
          {(profile.city || profile.state) && <span>⊙ {[profile.city, profile.state].filter(Boolean).join(", ")}</span>}
        </div>
      </div>
      {profile.summary && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 2, color: "#7c3aed" }}>About</p>
          <p style={{ margin: 0, color: "#3f3f46", fontWeight: 300 }}>{profile.summary}</p>
        </div>
      )}
      {profile.experiences.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: "0 0 12px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 2, color: "#7c3aed" }}>Experience</p>
          {profile.experiences.map(e => (
            <div key={e.id} style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{e.title}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#52525b" }}>{e.company}</p>
                {e.description && <div style={{ color: "#71717a", fontSize: 11, fontWeight: 300 }}><BulletList text={e.description} /></div>}
              </div>
              <p style={{ margin: 0, fontSize: 10, color: "#a1a1aa", textAlign: "right", whiteSpace: "nowrap" }}>{fmtDate(e.startDate)}<br />{e.current ? "Present" : fmtDate(e.endDate)}</p>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginBottom: 24 }}>
        {profile.educations.length > 0 && (
          <div>
            <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 2, color: "#7c3aed" }}>Education</p>
            {profile.educations.map(e => (
              <div key={e.id} style={{ marginBottom: 10 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{e.school}</p>
                {(e.degree || e.field) && <p style={{ margin: 0, fontSize: 11, color: "#71717a", fontWeight: 300 }}>{[e.degree, e.field].filter(Boolean).join(", ")}</p>}
                {(e.startDate || e.endDate) && <p style={{ margin: 0, fontSize: 10, color: "#a1a1aa" }}>{fmtDate(e.startDate)} – {fmtDate(e.endDate)}</p>}
              </div>
            ))}
          </div>
        )}
        {profile.skills.length > 0 && (
          <div>
            <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 2, color: "#7c3aed" }}>Skills</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {profile.skills.map(s => (
                <span key={s.id} style={{ border: "1px solid #e4e4e7", borderRadius: 3, padding: "1px 8px", fontSize: 11, color: "#52525b", fontWeight: 300 }}>{s.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      {profile.certifications.length > 0 && (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 2, color: "#7c3aed" }}>Certifications</p>
          {profile.certifications.map(c => (
            <p key={c.id} style={{ margin: "0 0 4px", fontSize: 11, color: "#52525b", fontWeight: 300 }}>
              {c.name}{c.issuer && ` · ${c.issuer}`}{c.expiryDate && ` · Exp ${fmtDate(c.expiryDate)}`}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Print page ───────────────────────────────────────────────
function PrintContent() {
  const searchParams = useSearchParams();
  const template = (searchParams.get("template") ?? "healthcare-pro") as TemplateId;
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(data => {
        setUser(data.user);
        setProfile(data.profile ?? { experiences: [], educations: [], skills: [], certifications: [] });
      });
  }, []);

  useEffect(() => {
    if (user && profile) {
      // Small delay so the DOM is fully rendered before printing
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [user, profile]);

  if (!user || !profile) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "Arial" }}>
        <p style={{ color: "#94a3b8" }}>Preparing your resume…</p>
      </div>
    );
  }

  const templates: Record<TemplateId, React.ReactNode> = {
    "healthcare-pro": <HealthcarePro user={user} profile={profile} />,
    "modern":         <Modern user={user} profile={profile} />,
    "classic":        <Classic user={user} profile={profile} />,
    "minimal":        <Minimal user={user} profile={profile} />,
  };

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { margin: 0 !important; }
          .no-print { display: none !important; }
        }
        body { margin: 0; background: white; }
      `}</style>
      <div className="no-print" style={{ background: "#f0f4f8", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "Arial", fontSize: 13 }}>
        <span style={{ color: "#5a6b7c" }}>Your resume is ready — use <strong>Save as PDF</strong> in the print dialog</span>
        <button onClick={() => window.print()} style={{ background: "#0090d9", color: "white", border: "none", borderRadius: 8, padding: "7px 18px", fontWeight: 600, cursor: "pointer" }}>
          Print / Save PDF
        </button>
      </div>
      {templates[template]}
    </>
  );
}

export default function ResumePrintPage() {
  return (
    <Suspense>
      <PrintContent />
    </Suspense>
  );
}
