"use client";

import { useEffect, useState } from "react";
import { Briefcase, Plus, Loader2, Trash2, MapPin, Clock, Users, X, Pause, Play } from "lucide-react";
import { motion } from "framer-motion";

interface Job {
  id: string;
  title: string;
  department: string | null;
  location: string;
  type: string;
  description: string | null;
  status: string;
  createdAt: string;
  candidateCount: number;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", department: "", location: "Remote", type: "Full-time", description: "" });

  const fetchJobs = () => {
    setLoading(true);
    fetch("/api/jobs")
      .then((r) => r.json())
      .then(setJobs)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchJobs(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { setForm({ title: "", department: "", location: "Remote", type: "Full-time", description: "" }); setShowForm(false); fetchJobs(); }
      else { const d = await res.json(); alert(d.error || "Failed to post job"); }
    } finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this job posting?")) return;
    setDeleteLoading(id);
    try {
      const res = await fetch(`/api/jobs?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchJobs();
      else { const d = await res.json(); alert(d.error || "Failed to delete"); }
    } finally { setDeleteLoading(null); }
  };

  const handleToggleStatus = async (job: Job) => {
    const newStatus = job.status === "open" ? "paused" : "open";
    try {
      const res = await fetch("/api/jobs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: job.id, status: newStatus }) });
      if (res.ok) fetchJobs();
      else { const d = await res.json(); alert(d.error || "Failed to update"); }
    } catch { alert("Failed to update job"); }
  };

  const inputClass = "rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1a2b3c] placeholder:text-[#8a95a3] focus:border-[#0090d9] focus:outline-none focus:ring-2 focus:ring-[#0090d9]/20";

  const statusColors: Record<string, string> = {
    open: "bg-[#ecfdf5] text-[#059669]",
    paused: "bg-[#fffbeb] text-[#b45309]",
    closed: "bg-[#f1f5f9] text-[#64748b]",
  };

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a2b3c]">Jobs</h1>
          <p className="text-sm text-[#5a6b7c]">Manage your job postings</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 rounded-lg bg-[#0090d9] px-4 py-2 text-sm font-medium text-white hover:bg-[#0077b6] transition-colors">
          <Plus className="h-4 w-4" /> Post Job
        </button>
      </div>

      {/* Post Job Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="card mb-4 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-[#0090d9]" />
              <h2 className="text-sm font-semibold text-[#1a2b3c]">New Job Posting</h2>
            </div>
            <button onClick={() => setShowForm(false)} className="rounded-lg p-1 text-[#8a95a3] hover:bg-[#f0f4f8]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input type="text" placeholder="Job Title *" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required className={inputClass} />
              <input type="text" placeholder="Department" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} className={inputClass} />
              <input type="text" placeholder="Location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className={inputClass} />
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={inputClass}>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
              </select>
            </div>
            <textarea placeholder="Job description (optional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className={inputClass + " w-full resize-none"} />
            <button type="submit" disabled={creating} className="rounded-lg bg-[#0090d9] px-4 py-2 text-sm font-medium text-white hover:bg-[#0077b6] transition-colors disabled:opacity-40">
              {creating ? "Posting..." : "Post Job"}
            </button>
          </form>
        </motion.div>
      )}

      {/* Job Listings */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#0090d9]" /></div>
      ) : jobs.length === 0 ? (
        <div className="card py-16 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-[#c4cdd8]" />
          <p className="mt-3 text-sm font-medium text-[#1a2b3c]">No job postings yet</p>
          <p className="mt-1 text-xs text-[#8a95a3]">Click &quot;Post Job&quot; to create your first job posting</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -1, transition: { duration: 0.15 } }}
              className="card px-4 py-3.5"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0090d9] text-xs font-medium text-white">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[#1a2b3c]">{job.title}</h3>
                    {job.department && <p className="text-xs text-[#5a6b7c]">{job.department}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-[#5a6b7c]">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#0090d9]" />
                    {job.location}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-[#0090d9]" />
                    {job.type}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-[#0090d9]" />
                    {job.candidateCount} candidate{job.candidateCount !== 1 ? "s" : ""}
                  </span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[job.status] || statusColors.closed}`}>
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggleStatus(job)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[#5a6b7c] hover:bg-[#f0f4f8] transition-colors"
                  >
                    {job.status === "open" ? <><Pause className="h-3 w-3" /> Pause</> : <><Play className="h-3 w-3" /> Resume</>}
                  </button>
                  <button
                    onClick={() => handleDelete(job.id)}
                    disabled={deleteLoading === job.id}
                    className="rounded-md p-1.5 text-[#8a95a3] hover:bg-[#fef2f2] hover:text-[#dc2626] transition-colors disabled:opacity-40"
                  >
                    {deleteLoading === job.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
