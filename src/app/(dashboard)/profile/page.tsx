"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import {
  User,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Briefcase,
  GraduationCap,
  Award,
  Star,
  Share2,
  Copy,
  Check,
  X,
  Phone,
  Mail,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Experience {
  id: string;
  title: string;
  company: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  current: boolean;
}

interface Education {
  id: string;
  school: string;
  degree: string | null;
  field: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface Skill {
  id: string;
  name: string;
}

interface Certification {
  id: string;
  name: string;
  issuer: string | null;
  issueDate: string | null;
  expiryDate: string | null;
}

interface Profile {
  id: string;
  headline: string | null;
  summary: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  referralCode: string | null;
  experiences: Experience[];
  educations: Education[];
  skills: Skill[];
  certifications: Certification[];
}

interface ProfileData {
  user: { id: string; name: string | null; email: string; image: string | null; role: string };
  profile: Profile | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return "Present";
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function toInputDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

// ─── Inline Edit Modal ──────────────────────────────────────────────────────

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4d8]/50 focus:border-[#00b4d8] transition-colors";
const btnPrimary =
  "px-4 py-2 bg-[#00b4d8] text-white text-sm font-medium rounded-lg hover:bg-[#0090d9] transition-colors disabled:opacity-50";
const btnSecondary =
  "px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors";

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user: clerkUser } = useUser();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Modal states
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingExperience, setEditingExperience] = useState<Experience | "new" | null>(null);
  const [editingEducation, setEditingEducation] = useState<Education | "new" | null>(null);
  const [editingCert, setEditingCert] = useState<Certification | "new" | null>(null);
  const [newSkill, setNewSkill] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    const res = await fetch("/api/profile");
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00b4d8]" />
      </div>
    );
  }

  const profile = data?.profile;
  const userName = data?.user?.name || clerkUser?.firstName || "User";
  const userEmail = data?.user?.email || "";
  const userImage = data?.user?.image || clerkUser?.imageUrl;

  const location = [profile?.city, profile?.state, profile?.country]
    .filter(Boolean)
    .join(", ");

  const referralUrl = profile?.referralCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/book?ref=${profile.referralCode}`
    : null;

  async function copyReferral() {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── Profile Info Save ──────────────────────────────────────────────────

  async function saveProfile(form: Record<string, string>) {
    setSaving(true);
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    await fetchProfile();
    setSaving(false);
    setEditingProfile(false);
  }

  // ─── Experience CRUD ────────────────────────────────────────────────────

  async function saveExperience(form: Record<string, unknown>) {
    setSaving(true);
    const isEdit = typeof editingExperience === "object" && editingExperience?.id;
    await fetch("/api/profile/experience", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit ? { id: editingExperience.id, ...form } : form),
    });
    await fetchProfile();
    setSaving(false);
    setEditingExperience(null);
  }

  async function deleteExperience(id: string) {
    await fetch("/api/profile/experience", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchProfile();
  }

  // ─── Education CRUD ─────────────────────────────────────────────────────

  async function saveEducation(form: Record<string, unknown>) {
    setSaving(true);
    const isEdit = typeof editingEducation === "object" && editingEducation?.id;
    await fetch("/api/profile/education", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit ? { id: editingEducation.id, ...form } : form),
    });
    await fetchProfile();
    setSaving(false);
    setEditingEducation(null);
  }

  async function deleteEducation(id: string) {
    await fetch("/api/profile/education", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchProfile();
  }

  // ─── Skills CRUD ────────────────────────────────────────────────────────

  async function addSkill() {
    if (!newSkill.trim()) return;
    await fetch("/api/profile/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSkill.trim() }),
    });
    setNewSkill("");
    fetchProfile();
  }

  async function deleteSkill(id: string) {
    await fetch("/api/profile/skills", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchProfile();
  }

  // ─── Certifications CRUD ────────────────────────────────────────────────

  async function saveCert(form: Record<string, unknown>) {
    setSaving(true);
    const isEdit = typeof editingCert === "object" && editingCert?.id;
    await fetch("/api/profile/certifications", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit ? { id: editingCert.id, ...form } : form),
    });
    await fetchProfile();
    setSaving(false);
    setEditingCert(null);
  }

  async function deleteCert(id: string) {
    await fetch("/api/profile/certifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchProfile();
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* ── Profile Header Card ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border overflow-hidden"
      >
        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-[#00b4d8] to-[#0077b6]" />

        <div className="px-8 pb-6 -mt-12">
          <div className="flex items-end justify-between">
            {/* Avatar */}
            <div className="flex items-end gap-4">
              {userImage ? (
                <img
                  src={userImage}
                  alt={userName}
                  className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-white shadow-md bg-[#00b4d8] flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setEditingProfile(true)}
              className="mt-14 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Pencil className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="mt-3">
            <h1 className="text-2xl font-bold text-gray-900">{userName}</h1>
            {profile?.headline && (
              <p className="text-gray-600 mt-0.5">{profile.headline}</p>
            )}
            {location && (
              <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {location}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> {userEmail}
              </span>
              {profile?.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> {profile.phone}
                </span>
              )}
            </div>
          </div>

          {profile?.summary && (
            <p className="mt-4 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {profile.summary}
            </p>
          )}
        </div>
      </motion.div>

      {/* ── Referral Link ───────────────────────────────────────────────── */}
      {referralUrl && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl shadow-sm border p-6"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-[#00b4d8]" />
              <h2 className="text-lg font-semibold text-gray-900">Share The Link</h2>
            </div>
            <button
              onClick={copyReferral}
              className="px-4 py-2 bg-[#00b4d8] text-white text-sm font-medium rounded-full hover:bg-[#0090d9] transition-colors"
            >
              Refer & Earn
            </button>
          </div>
          <div className="flex items-center gap-2 bg-[#fffbe6] rounded-lg border border-yellow-200 px-4 py-3">
            <input
              readOnly
              value={referralUrl}
              className="flex-1 bg-transparent text-sm text-gray-700 outline-none"
            />
            <button onClick={copyReferral} className="p-1.5 hover:bg-yellow-100 rounded transition-colors">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
          <p className="text-center text-sm text-green-600 mt-2">
            Invite a friend and get up to $5
          </p>
        </motion.div>
      )}

      {/* ── Experience ──────────────────────────────────────────────────── */}
      <SectionCard
        title="Experience"
        icon={<Briefcase className="w-5 h-5 text-[#00b4d8]" />}
        onAdd={() => setEditingExperience("new")}
        delay={0.1}
      >
        {(!profile?.experiences || profile.experiences.length === 0) ? (
          <EmptyState text="No experience added yet" />
        ) : (
          <div className="divide-y">
            {profile.experiences.map((exp) => (
              <div key={exp.id} className="py-4 first:pt-0 last:pb-0 group">
                <div className="flex justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">{exp.title}</h4>
                    <p className="text-sm text-gray-600">{exp.company}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(exp.startDate)} - {exp.current ? "Present" : formatDate(exp.endDate)}
                    </p>
                    {exp.description && (
                      <ul className="mt-2 space-y-1">
                        {exp.description.split("\n").filter(Boolean).map((line, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0090d9]" />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingExperience(exp)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => deleteExperience(exp.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Education ───────────────────────────────────────────────────── */}
      <SectionCard
        title="Education"
        icon={<GraduationCap className="w-5 h-5 text-[#00b4d8]" />}
        onAdd={() => setEditingEducation("new")}
        delay={0.15}
      >
        {(!profile?.educations || profile.educations.length === 0) ? (
          <EmptyState text="No education added yet" />
        ) : (
          <div className="divide-y">
            {profile.educations.map((edu) => (
              <div key={edu.id} className="py-4 first:pt-0 last:pb-0 group">
                <div className="flex justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">{edu.school}</h4>
                    {(edu.degree || edu.field) && (
                      <p className="text-sm text-gray-600">
                        {[edu.degree, edu.field].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {(edu.startDate || edu.endDate) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(edu.startDate)} - {formatDate(edu.endDate)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingEducation(edu)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => deleteEducation(edu.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Skills ──────────────────────────────────────────────────────── */}
      <SectionCard
        title="Skills"
        icon={<Star className="w-5 h-5 text-[#00b4d8]" />}
        delay={0.2}
      >
        <div className="flex flex-wrap gap-2 mb-3">
          {profile?.skills?.map((skill) => (
            <span
              key={skill.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#e8f7fa] text-[#0077b6] text-sm rounded-full group"
            >
              {skill.name}
              <button
                onClick={() => deleteSkill(skill.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3.5 h-3.5 text-[#0077b6]/60 hover:text-red-500" />
              </button>
            </span>
          ))}
          {(!profile?.skills || profile.skills.length === 0) && (
            <p className="text-sm text-gray-400">No skills added yet</p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSkill()}
            placeholder="Add a skill..."
            className={inputClass + " flex-1"}
          />
          <button onClick={addSkill} className={btnPrimary}>
            Add
          </button>
        </div>
      </SectionCard>

      {/* ── Certifications ──────────────────────────────────────────────── */}
      <SectionCard
        title="Certifications"
        icon={<Award className="w-5 h-5 text-[#00b4d8]" />}
        onAdd={() => setEditingCert("new")}
        delay={0.25}
      >
        {(!profile?.certifications || profile.certifications.length === 0) ? (
          <EmptyState text="No certifications added yet" />
        ) : (
          <div className="divide-y">
            {profile.certifications.map((cert) => (
              <div key={cert.id} className="py-4 first:pt-0 last:pb-0 group">
                <div className="flex justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">{cert.name}</h4>
                    {cert.issuer && <p className="text-sm text-gray-600">{cert.issuer}</p>}
                    {cert.issueDate && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Issued {formatDate(cert.issueDate)}
                        {cert.expiryDate && ` · Expires ${formatDate(cert.expiryDate)}`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingCert(cert)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => deleteCert(cert.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ═══ Modals ═══════════════════════════════════════════════════════ */}

      {/* Edit Profile Modal */}
      <Modal open={editingProfile} onClose={() => setEditingProfile(false)} title="Edit Profile">
        <ProfileForm
          initial={{
            name: userName,
            headline: profile?.headline || "",
            summary: profile?.summary || "",
            phone: profile?.phone || "",
            city: profile?.city || "",
            state: profile?.state || "",
            country: profile?.country || "United States",
          }}
          saving={saving}
          onSave={saveProfile}
          onCancel={() => setEditingProfile(false)}
        />
      </Modal>

      {/* Experience Modal */}
      <Modal
        open={editingExperience !== null}
        onClose={() => setEditingExperience(null)}
        title={editingExperience === "new" ? "Add Experience" : "Edit Experience"}
      >
        <ExperienceForm
          initial={typeof editingExperience === "object" ? editingExperience ?? undefined : undefined}
          saving={saving}
          onSave={saveExperience}
          onCancel={() => setEditingExperience(null)}
        />
      </Modal>

      {/* Education Modal */}
      <Modal
        open={editingEducation !== null}
        onClose={() => setEditingEducation(null)}
        title={editingEducation === "new" ? "Add Education" : "Edit Education"}
      >
        <EducationForm
          initial={typeof editingEducation === "object" ? editingEducation ?? undefined : undefined}
          saving={saving}
          onSave={saveEducation}
          onCancel={() => setEditingEducation(null)}
        />
      </Modal>

      {/* Certification Modal */}
      <Modal
        open={editingCert !== null}
        onClose={() => setEditingCert(null)}
        title={editingCert === "new" ? "Add Certification" : "Edit Certification"}
      >
        <CertificationForm
          initial={typeof editingCert === "object" ? editingCert ?? undefined : undefined}
          saving={saving}
          onSave={saveCert}
          onCancel={() => setEditingCert(null)}
        />
      </Modal>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon,
  onAdd,
  delay = 0,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onAdd?: () => void;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white rounded-2xl shadow-sm border p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="text-sm text-[#00b4d8] hover:text-[#0090d9] font-medium flex items-center gap-1 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add {title}
          </button>
        )}
      </div>
      {children}
    </motion.div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 py-2">{text}</p>;
}

// ─── Forms ─────────────────────────────────────────────────────────────────

function ProfileForm({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: Record<string, string>;
  saving: boolean;
  onSave: (data: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <FormField label="Full Name">
        <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} />
      </FormField>
      <FormField label="Headline">
        <input
          className={inputClass}
          value={form.headline}
          onChange={(e) => set("headline", e.target.value)}
          placeholder="e.g. Executive Leadership"
        />
      </FormField>
      <FormField label="Phone">
        <input className={inputClass} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </FormField>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="City">
          <input className={inputClass} value={form.city} onChange={(e) => set("city", e.target.value)} />
        </FormField>
        <FormField label="State">
          <input className={inputClass} value={form.state} onChange={(e) => set("state", e.target.value)} />
        </FormField>
        <FormField label="Country">
          <input className={inputClass} value={form.country} onChange={(e) => set("country", e.target.value)} />
        </FormField>
      </div>
      <FormField label="About">
        <textarea
          className={inputClass + " min-h-[100px] resize-none"}
          value={form.summary}
          onChange={(e) => set("summary", e.target.value)}
          placeholder="Tell us about yourself..."
        />
      </FormField>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving} className={btnPrimary}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function ExperienceForm({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial?: Experience;
  saving: boolean;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [company, setCompany] = useState(initial?.company || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [startDate, setStartDate] = useState(toInputDate(initial?.startDate || null));
  const [endDate, setEndDate] = useState(toInputDate(initial?.endDate || null));
  const [current, setCurrent] = useState(initial?.current || false);

  return (
    <div className="space-y-4">
      <FormField label="Title *">
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. LPN" />
      </FormField>
      <FormField label="Company *">
        <input className={inputClass} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Moffitt" />
      </FormField>
      <FormField label="Description">
        <textarea
          className={inputClass + " min-h-[110px] resize-none"}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={"One bullet point per line, e.g.:\nAdministered medications to 12+ patients daily\nMaintained zero incident reports over 2 years"}
        />
        <p className="mt-1 text-[10px] text-gray-400">Each line becomes a bullet point on your resume</p>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Start Date *">
          <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </FormField>
        <FormField label="End Date">
          <input
            type="date"
            className={inputClass}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={current}
          />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={current}
          onChange={(e) => setCurrent(e.target.checked)}
          className="rounded border-gray-300 text-[#00b4d8] focus:ring-[#00b4d8]"
        />
        I currently work here
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button
          onClick={() => onSave({ title, company, description, startDate, endDate: current ? null : endDate, current })}
          disabled={saving || !title || !company || !startDate}
          className={btnPrimary}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function EducationForm({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial?: Education;
  saving: boolean;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [school, setSchool] = useState(initial?.school || "");
  const [degree, setDegree] = useState(initial?.degree || "");
  const [field, setField] = useState(initial?.field || "");
  const [startDate, setStartDate] = useState(toInputDate(initial?.startDate || null));
  const [endDate, setEndDate] = useState(toInputDate(initial?.endDate || null));

  return (
    <div className="space-y-4">
      <FormField label="School *">
        <input className={inputClass} value={school} onChange={(e) => setSchool(e.target.value)} />
      </FormField>
      <FormField label="Degree">
        <input className={inputClass} value={degree} onChange={(e) => setDegree(e.target.value)} placeholder="e.g. Bachelor of Science" />
      </FormField>
      <FormField label="Field of Study">
        <input className={inputClass} value={field} onChange={(e) => setField(e.target.value)} placeholder="e.g. Nursing" />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Start Date">
          <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </FormField>
        <FormField label="End Date">
          <input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </FormField>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button
          onClick={() => onSave({ school, degree, field, startDate: startDate || null, endDate: endDate || null })}
          disabled={saving || !school}
          className={btnPrimary}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function CertificationForm({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial?: Certification;
  saving: boolean;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [issuer, setIssuer] = useState(initial?.issuer || "");
  const [issueDate, setIssueDate] = useState(toInputDate(initial?.issueDate || null));
  const [expiryDate, setExpiryDate] = useState(toInputDate(initial?.expiryDate || null));

  return (
    <div className="space-y-4">
      <FormField label="Certification Name *">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Registered Nurse (RN)" />
      </FormField>
      <FormField label="Issuing Organization">
        <input className={inputClass} value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="e.g. Florida Board of Nursing" />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Issue Date">
          <input type="date" className={inputClass} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </FormField>
        <FormField label="Expiry Date">
          <input type="date" className={inputClass} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </FormField>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button
          onClick={() => onSave({ name, issuer, issueDate: issueDate || null, expiryDate: expiryDate || null })}
          disabled={saving || !name}
          className={btnPrimary}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
