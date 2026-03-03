"use client";

import { useEffect, useState } from "react";
import { CandidateTable } from "@/components/candidate-table";
import { Bot, Loader2 } from "lucide-react";

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
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) { setForm({ name: "", email: "", phone: "", position: "" }); fetchCandidates(); }
      else { const data = await res.json(); alert(data.error || "Failed to add"); }
    } finally { setAdding(false); }
  };

  const handleContactAi = async (c: Candidate) => {
    const message = `Contact the candidate with ID "${c.id}" for the ${c.position} position. Send them an email first, and if they have a phone number, also send an SMS.`;
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

  const inputClass = "rounded-lg border border-teal-100/60 bg-white/40 px-3 py-2 text-sm text-teal-900 placeholder:text-teal-500 transition-colors focus:border-teal-300 focus:bg-white/60 focus:outline-none";

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-teal-900">Candidates</h1>
        <p className="text-sm text-teal-700">Manage candidates and AI outreach</p>
      </div>

      <div className="glass mb-6 rounded-xl px-5 py-4">
        <h2 className="mb-3 text-sm font-medium text-teal-800">Add Candidate</h2>
        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input type="text" placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className={inputClass} />
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required className={inputClass} />
          <input type="tel" placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputClass} />
          <input type="text" placeholder="Position" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} required className={inputClass} />
          <button type="submit" disabled={adding} className="rounded-lg bg-teal-500/15 px-3 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-500/25 disabled:opacity-40">
            {adding ? "Adding..." : "Add"}
          </button>
        </form>
      </div>

      {aiPrompt && (
        <div className="glass mb-4 rounded-xl px-5 py-3">
          <div className="flex items-start gap-2">
            <Bot className="mt-0.5 h-4 w-4 text-teal-600" />
            <div>
              <p className="text-xs font-medium text-teal-800">AI Agent</p>
              <p className="mt-0.5 text-xs text-teal-700">{aiPrompt}</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
        </div>
      ) : (
        <CandidateTable candidates={candidates} onContactAi={handleContactAi} aiLoading={aiLoading} />
      )}
    </div>
  );
}
