"use client";

import { useEffect, useState } from "react";
import { CandidateTable } from "@/components/candidate-table";

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
    const message = `Contact candidate ${c.name} (${c.email}) for the ${c.position} position. Send them an email and SMS if they have a phone number.`;
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
    } catch (e) {
      alert("Agent request failed");
    } finally {
      setAiLoading(null);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Candidates</h1>
        <p className="mt-1 text-slate-500">Manage candidates and contact via AI</p>
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Add Candidate</h2>
        <form onSubmit={handleAdd} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="tel"
            placeholder="Phone (optional)"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Position"
            value={form.position}
            onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={adding}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {adding ? "Adding..." : "Add Candidate"}
          </button>
        </form>
      </div>

      {aiPrompt && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <strong>AI Agent:</strong> {aiPrompt}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading...</div>
      ) : (
        <CandidateTable
          candidates={candidates}
          onContactAi={handleContactAi}
        />
      )}
    </div>
  );
}
