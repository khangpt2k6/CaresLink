"use client";

import { useEffect, useState } from "react";
import { CandidateTable } from "@/components/candidate-table";
import { Bot, Loader2, UserPlus } from "lucide-react";

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string;
  status: string;
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", position: "" });

  const fetchCandidates = () => {
    setLoading(true);
    fetch("/api/candidates")
      .then((r) => r.json())
      .then(setCandidates)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCandidates(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch("/api/candidates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { setForm({ name: "", email: "", phone: "", position: "" }); fetchCandidates(); }
      else { const data = await res.json(); alert(data.error || "Failed to add"); }
    } finally { setAdding(false); }
  };

  const handleEdit = async (id: string, data: { name: string; email: string; phone: string; position: string }) => {
    try {
      const res = await fetch("/api/candidates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...data }) });
      if (res.ok) fetchCandidates();
      else { const d = await res.json(); alert(d.error || "Failed to update"); }
    } catch { alert("Failed to update candidate"); }
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(id);
    try {
      const res = await fetch(`/api/candidates?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchCandidates();
      else { const d = await res.json(); alert(d.error || "Failed to delete"); }
    } catch { alert("Failed to delete candidate"); }
    finally { setDeleteLoading(null); }
  };

  const handleContactAi = async (c: Candidate) => {
    const message = `Contact the candidate with ID "${c.id}" for the ${c.position} position. Send them a professional email, find available interview slots, and automatically book the earliest one. Include the interview time in the email.`;
    setAiLoading(c.id);
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const data = await res.json();
      if (data.response) setAiPrompt(data.response);
      else alert(data.error || "Agent failed");
      fetchCandidates();
    } catch { alert("Agent request failed"); }
    finally { setAiLoading(null); }
  };

  const inputClass =
    "rounded-md border border-[#e8e8e5] bg-white px-3 py-2 text-sm text-[#37352f] placeholder:text-[#b4b4b0] focus:border-[#2383e2] focus:outline-none focus:ring-1 focus:ring-[#2383e2]/20";

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-[#37352f]">Candidates</h1>
      <p className="mt-1 text-sm text-[#9b9a97]">Manage candidates and AI outreach</p>

      {/* Add Candidate Form */}
      <div className="card mt-6 mb-6 p-5">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-[#9b9a97]" />
          <h2 className="text-sm font-semibold text-[#37352f]">Add Candidate</h2>
        </div>
        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input type="text" placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className={inputClass} />
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required className={inputClass} />
          <input type="tel" placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputClass} />
          <input type="text" placeholder="Position" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} required className={inputClass} />
          <button type="submit" disabled={adding} className="rounded-md bg-[#2383e2] px-4 py-2 text-sm font-medium text-white hover:bg-[#1b6ec2] transition-colors disabled:opacity-40">
            {adding ? "Adding..." : "Add"}
          </button>
        </form>
      </div>

      {/* AI Response */}
      {aiPrompt && (
        <div className="card animate-in mb-5 border-l-2 border-l-[#2383e2] p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-[#f0f7ff] p-1.5">
              <Bot className="h-4 w-4 text-[#2383e2]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#37352f]">AI Agent</p>
              <p className="mt-1 text-sm leading-relaxed text-[#73726e]">{aiPrompt}</p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[#9b9a97]" />
        </div>
      ) : (
        <CandidateTable
          candidates={candidates}
          onContactAi={handleContactAi}
          onEdit={handleEdit}
          onDelete={handleDelete}
          aiLoading={aiLoading}
          deleteLoading={deleteLoading}
        />
      )}
    </div>
  );
}
