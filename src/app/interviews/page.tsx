"use client";

import { useEffect, useState } from "react";
import { InterviewCard } from "@/components/interview-card";
import { format } from "date-fns";
import { Calendar, Loader2, Plus, Clock, CalendarPlus, X } from "lucide-react";

interface Interview {
  id: string;
  position: string;
  scheduledAt: string;
  duration: number;
  location: string;
  reminderSent: boolean;
  calendarLink: string | null;
  meetLink: string | null;
  candidate: { name: string; email: string; phone: string | null };
}

interface Candidate { id: string; name: string; email: string; position: string; }

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  const fetchInterviews = () => {
    setLoading(true);
    fetch("/api/interviews?upcoming=true").then((r) => r.json()).then(setInterviews).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchInterviews(); }, []);

  const handleOpenBooking = async () => { setShowBooking(true); const res = await fetch("/api/candidates"); setCandidates(await res.json()); };

  const handleSelectCandidate = async (candidateId: string) => {
    setSelectedCandidate(candidateId); setSelectedSlot(""); setSlotsLoading(true);
    try { const res = await fetch(`/api/interviews/slots?candidateId=${candidateId}`); const data = await res.json(); setSlots(data.slots || []); }
    catch { setSlots([]); } finally { setSlotsLoading(false); }
  };

  const handleBook = async () => {
    if (!selectedCandidate || !selectedSlot) return;
    setBookingLoading(true);
    try {
      const res = await fetch("/api/interviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: selectedCandidate, scheduledAt: selectedSlot }) });
      if (res.ok) { setShowBooking(false); setSelectedCandidate(""); setSelectedSlot(""); setSlots([]); fetchInterviews(); }
      else { const data = await res.json(); alert(data.error || "Failed to book"); }
    } finally { setBookingLoading(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(id);
    try { const res = await fetch(`/api/interviews?id=${id}`, { method: "DELETE" }); if (res.ok) fetchInterviews(); else { const d = await res.json(); alert(d.error || "Failed to cancel"); } }
    catch { alert("Failed to cancel interview"); } finally { setDeleteLoading(null); }
  };

  const handleSendReminder = async (id: string) => {
    setReminderLoading(id);
    try { const res = await fetch("/api/interviews/reminder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId: id }) }); const data = await res.json(); if (data.success) fetchInterviews(); else alert(data.error || data.message || "Failed"); }
    catch { alert("Failed to send reminder"); } finally { setReminderLoading(null); }
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#37352f]">Interviews</h1>
          <p className="mt-1 text-sm text-[#9b9a97]">Upcoming sessions & reminders</p>
        </div>
        <button onClick={handleOpenBooking} className="inline-flex items-center gap-2 rounded-md bg-[#2383e2] px-4 py-2 text-sm font-medium text-white hover:bg-[#1b6ec2] transition-colors">
          <Plus className="h-4 w-4" /> Book Interview
        </button>
      </div>

      {/* Booking Panel */}
      {showBooking && (
        <div className="card mb-6 p-5 animate-in">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarPlus className="h-4 w-4 text-[#9b9a97]" />
              <h2 className="text-sm font-semibold text-[#37352f]">Schedule Interview</h2>
            </div>
            <button onClick={() => setShowBooking(false)} className="rounded-md p-1 text-[#9b9a97] hover:bg-[#f1f1ef]">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-[#73726e]">Select Candidate</label>
            <select value={selectedCandidate} onChange={(e) => handleSelectCandidate(e.target.value)}
              className="w-full rounded-md border border-[#e8e8e5] bg-white px-3 py-2 text-sm text-[#37352f] focus:border-[#2383e2] focus:outline-none">
              <option value="">Choose a candidate...</option>
              {candidates.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.position}</option>)}
            </select>
          </div>

          {selectedCandidate && (
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-[#73726e]">Available Time Slots</label>
              {slotsLoading ? (
                <div className="flex items-center gap-2 py-3 text-xs text-[#9b9a97]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking availability...</div>
              ) : slots.length === 0 ? (
                <p className="py-2 text-xs text-[#9b9a97]">No available slots found for the next 7 days.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {slots.map((slot) => {
                    const d = new Date(slot);
                    const isSelected = selectedSlot === slot;
                    return (
                      <button key={slot} onClick={() => setSelectedSlot(slot)}
                        className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-left text-xs transition-all ${
                          isSelected ? "border-[#2383e2] bg-[#f0f7ff] text-[#37352f]" : "border-[#e8e8e5] text-[#73726e] hover:border-[#d4d4d0] hover:bg-[#f7f7f5]"
                        }`}>
                        <Clock className="h-3.5 w-3.5 flex-shrink-0 text-[#9b9a97]" />
                        <div>
                          <div className="font-medium">{format(d, "EEE, MMM d")}</div>
                          <div className="text-[#9b9a97]">{format(d, "h:mm a")}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {selectedSlot && (
            <button onClick={handleBook} disabled={bookingLoading}
              className="inline-flex items-center gap-2 rounded-md bg-[#2383e2] px-4 py-2 text-sm font-medium text-white hover:bg-[#1b6ec2] transition-colors disabled:opacity-50">
              {bookingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
              {bookingLoading ? "Scheduling..." : "Confirm & Send Calendar Invite"}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-[#9b9a97]" /></div>
      ) : (
        <div className="space-y-2">
          {interviews.map((i) => (
            <InterviewCard key={i.id} interview={i} onSendReminder={handleSendReminder} onDelete={handleDelete} reminderLoading={reminderLoading} deleteLoading={deleteLoading} />
          ))}
          {interviews.length === 0 && (
            <div className="card py-16 text-center">
              <Calendar className="mx-auto h-8 w-8 text-[#d4d4d0]" />
              <p className="mt-3 text-sm font-medium text-[#37352f]">No upcoming interviews</p>
              <p className="mt-1 text-xs text-[#9b9a97]">Click &quot;Book Interview&quot; to schedule one</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
