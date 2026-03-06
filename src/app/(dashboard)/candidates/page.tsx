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
    const message = `Contact the candidate with ID "${c.id}" for the ${c.position} position. Send them the booking link so they can choose their own interview time.`;
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
    "rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1a2b3c] placeholder:text-[#8a95a3] focus:border-[#0090d9] focus:outline-none focus:ring-2 focus:ring-[#0090d9]/20";

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[#1a2b3c]">Candidates</h1>
        <p className="text-sm text-[#5a6b7c]">Manage candidates and AI outreach</p>
      </div>

      {/* Add Candidate Form */}
      <div className="card mb-4 p-5">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-[#0090d9]" />
          <h2 className="text-sm font-semibold text-[#1a2b3c]">Add Candidate</h2>
        </div>
        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input type="text" placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className={inputClass} />
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required className={inputClass} />
          <input type="tel" placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputClass} />
          <input type="text" placeholder="Position" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} required className={inputClass} />
          <button type="submit" disabled={adding} className="rounded-lg bg-[#0090d9] px-4 py-2 text-sm font-medium text-white hover:bg-[#0077b6] transition-colors disabled:opacity-40">
            {adding ? "Adding..." : "Add"}
          </button>
        </form>
      </div>

      {/* AI Response */}
      {aiPrompt && (
        <div className="card animate-in mb-4 border-l-3 border-l-[#0090d9] p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#e8f4fd] p-1.5">
              <Bot className="h-4 w-4 text-[#0090d9]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#1a2b3c]">AI Agent</p>
              <p className="mt-1 text-sm leading-relaxed text-[#5a6b7c]">{aiPrompt}</p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[#0090d9]" />
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
