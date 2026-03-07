"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
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
  confirmed: boolean;
  calendarLink: string | null;
  meetLink: string | null;
  candidate: { name: string; email: string; phone: string | null };
}

interface Candidate { id: string; name: string; email: string; position: string; }

export default function InterviewsPage() {
  const { data: session } = useSession();
  const isRecruiter = session?.user?.role === "EMPLOYER";
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
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a2b3c]">Interviews</h1>
          <p className="text-sm text-[#5a6b7c]">{isRecruiter ? "Upcoming sessions & reminders" : "Your upcoming interviews"}</p>
        </div>
        {isRecruiter && (
          <button onClick={handleOpenBooking} className="inline-flex items-center gap-2 rounded-lg bg-[#0090d9] px-4 py-2 text-sm font-medium text-white hover:bg-[#0077b6] transition-colors">
            <Plus className="h-4 w-4" /> Book Interview
          </button>
        )}
      </div>

      {/* Booking Panel — recruiter only */}
      {isRecruiter && showBooking && (
        <div className="card mb-4 p-5 animate-in">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarPlus className="h-4 w-4 text-[#0090d9]" />
              <h2 className="text-sm font-semibold text-[#1a2b3c]">Schedule Interview</h2>
            </div>
            <button onClick={() => setShowBooking(false)} className="rounded-lg p-1 text-[#8a95a3] hover:bg-[#f0f4f8]">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-[#5a6b7c]">Select Candidate</label>
            <select value={selectedCandidate} onChange={(e) => handleSelectCandidate(e.target.value)}
              className="w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1a2b3c] focus:border-[#0090d9] focus:outline-none focus:ring-2 focus:ring-[#0090d9]/20">
              <option value="">Choose a candidate...</option>
              {candidates.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.position}</option>)}
            </select>
          </div>

          {selectedCandidate && (
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-[#5a6b7c]">Available Time Slots</label>
              {slotsLoading ? (
                <div className="flex items-center gap-2 py-3 text-xs text-[#8a95a3]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking availability...</div>
              ) : slots.length === 0 ? (
                <p className="py-2 text-xs text-[#8a95a3]">No available slots found for the next 7 days.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {slots.map((slot) => {
                    const d = new Date(slot);
                    const isSelected = selectedSlot === slot;
                    return (
                      <button key={slot} onClick={() => setSelectedSlot(slot)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-all ${
                          isSelected ? "border-[#0090d9] bg-[#e8f4fd] text-[#1a2b3c]" : "border-[#e2e8f0] text-[#5a6b7c] hover:border-[#0090d9]/30 hover:bg-[#f8fafc]"
                        }`}>
                        <Clock className="h-3.5 w-3.5 flex-shrink-0 text-[#0090d9]" />
                        <div>
                          <div className="font-medium">{format(d, "EEE, MMM d")}</div>
                          <div className="text-[#8a95a3]">{format(d, "h:mm a")}</div>
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
              className="inline-flex items-center gap-2 rounded-lg bg-[#0090d9] px-4 py-2 text-sm font-medium text-white hover:bg-[#0077b6] transition-colors disabled:opacity-50">
              {bookingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
              {bookingLoading ? "Scheduling..." : "Confirm & Send Calendar Invite"}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-[#0090d9]" /></div>
      ) : (
        <div className="space-y-2">
          {interviews.map((i) => (
            <InterviewCard key={i.id} interview={i} onSendReminder={handleSendReminder} onDelete={handleDelete} reminderLoading={reminderLoading} deleteLoading={deleteLoading} showRecruiterActions={isRecruiter} />
          ))}
          {interviews.length === 0 && (
            <div className="card py-16 text-center">
              <Calendar className="mx-auto h-8 w-8 text-[#c4cdd8]" />
              <p className="mt-3 text-sm font-medium text-[#1a2b3c]">No upcoming interviews</p>
              <p className="mt-1 text-xs text-[#8a95a3]">
                {isRecruiter ? 'Click "Book Interview" to schedule one' : 'You have no upcoming interviews scheduled.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
