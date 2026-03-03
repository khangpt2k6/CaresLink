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
  const [aiPrompt, setAiPrompt] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    position: "",
  });

  const fetchCandidates = () => {
    setLoading(true);
    fetch("/api/candidates")
      .then((r) => r.json())
      .then(setCandidates)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ name: "", email: "", phone: "", position: "" });
        fetchCandidates();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleContactAi = async (c: Candidate) => {
    const message = `Contact the candidate with ID "${c.id}" for the ${c.position} position. Send them an email first, and if they have a phone number, also send an SMS.`;
    setAiLoading(c.id);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (data.response) setAiPrompt(data.response);
      else alert(data.error || "Agent failed");
      fetchCandidates();
    } catch {
      alert("Agent request failed");
    } finally {
      setAiLoading(null);
    }
  };

  const inputClass =
    "rounded-xl border border-teal-100/60 bg-white/50 px-3.5 py-2.5 text-sm text-teal-900 placeholder:text-teal-400 transition-all focus:border-teal-300 focus:bg-white/70 focus:outline-none focus:ring-2 focus:ring-teal-200/30";

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-teal-900">Candidates</h1>
        <p className="text-sm text-teal-700">
          Manage candidates and AI outreach
        </p>
      </div>

      {/* Add Candidate Form */}
      <div className="glass mb-6 rounded-2xl px-6 py-5">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-teal-800">
            Add Candidate
          </h2>
        </div>
        <form
          onSubmit={handleAdd}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <input
            type="text"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            className={inputClass}
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
            className={inputClass}
          />
          <input
            type="tel"
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Position"
            value={form.position}
            onChange={(e) =>
              setForm((f) => ({ ...f, position: e.target.value }))
            }
            required
            className={inputClass}
          />
          <button
            type="submit"
            disabled={adding}
            className="rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-teal-500/20 transition-all hover:shadow-teal-500/30 hover:brightness-110 disabled:opacity-40"
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </form>
      </div>

      {/* AI Response */}
      {aiPrompt && (
        <div className="glass animate-in mb-5 rounded-2xl border-l-2 border-l-teal-400 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-gradient-to-br from-teal-100 to-teal-50 p-1.5">
              <Bot className="h-4 w-4 text-teal-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-teal-800">AI Agent</p>
              <p className="mt-1 text-xs leading-relaxed text-teal-700">
                {aiPrompt}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
        </div>
      ) : (
        <CandidateTable
          candidates={candidates}
          onContactAi={handleContactAi}
          aiLoading={aiLoading}
        />
      )}
    </div>
  );
}
