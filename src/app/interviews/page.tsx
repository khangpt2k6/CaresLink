"use client";

import { useEffect, useState } from "react";
import { InterviewCard } from "@/components/interview-card";
import { format } from "date-fns";
import {
  Calendar,
  Loader2,
  Plus,
  Clock,
  CalendarPlus,
  X,
} from "lucide-react";

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

interface Candidate {
  id: string;
  name: string;
  email: string;
  position: string;
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  // Booking state
  const [showBooking, setShowBooking] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  const fetchInterviews = () => {
    setLoading(true);
    fetch("/api/interviews?upcoming=true")
      .then((r) => r.json())
      .then(setInterviews)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInterviews();
  }, []);

  const handleOpenBooking = async () => {
    setShowBooking(true);
    const res = await fetch("/api/candidates");
    const data = await res.json();
    setCandidates(data);
  };

  const handleSelectCandidate = async (candidateId: string) => {
    setSelectedCandidate(candidateId);
    setSelectedSlot("");
    setSlotsLoading(true);
    try {
      const res = await fetch(
        `/api/interviews/slots?candidateId=${candidateId}`
      );
      const data = await res.json();
      setSlots(data.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleBook = async () => {
    if (!selectedCandidate || !selectedSlot) return;
    setBookingLoading(true);
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: selectedCandidate,
          scheduledAt: selectedSlot,
        }),
      });
      if (res.ok) {
        setShowBooking(false);
        setSelectedCandidate("");
        setSelectedSlot("");
        setSlots([]);
        fetchInterviews();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to book");
      }
    } finally {
      setBookingLoading(false);
    }
  };

  const handleDelete = async (interviewId: string) => {
    setDeleteLoading(interviewId);
    try {
      const res = await fetch(`/api/interviews?id=${interviewId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchInterviews();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to cancel");
      }
    } catch {
      alert("Failed to cancel interview");
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleSendReminder = async (interviewId: string) => {
    setReminderLoading(interviewId);
    try {
      const res = await fetch("/api/interviews/reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId }),
      });
      const data = await res.json();
      if (data.success) fetchInterviews();
      else alert(data.error || data.message || "Failed");
    } catch {
      alert("Failed to send reminder");
    } finally {
      setReminderLoading(null);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-teal-900">Interviews</h1>
          <p className="text-sm text-teal-700">
            Upcoming sessions & reminders
          </p>
        </div>
        <button
          onClick={handleOpenBooking}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-teal-500/20 transition-all hover:shadow-teal-500/30 hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Book Interview
        </button>
      </div>

      {/* Booking Panel */}
      {showBooking && (
        <div className="glass mb-6 rounded-2xl px-6 py-5 animate-in">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarPlus className="h-4 w-4 text-teal-600" />
              <h2 className="text-sm font-semibold text-teal-900">
                Schedule Interview
              </h2>
            </div>
            <button
              onClick={() => setShowBooking(false)}
              className="rounded-lg p-1 text-teal-500 hover:bg-teal-50/60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Step 1: Select candidate */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-teal-700">
              Select Candidate
            </label>
            <select
              value={selectedCandidate}
              onChange={(e) => handleSelectCandidate(e.target.value)}
              className="w-full rounded-xl border border-teal-100/60 bg-white/50 px-3 py-2.5 text-sm text-teal-900 focus:border-teal-300 focus:outline-none"
            >
              <option value="">Choose a candidate...</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.position}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Select time slot */}
          {selectedCandidate && (
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-teal-700">
                Available Time Slots
              </label>
              {slotsLoading ? (
                <div className="flex items-center gap-2 py-3 text-xs text-teal-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Checking availability...
                </div>
              ) : slots.length === 0 ? (
                <p className="py-2 text-xs text-teal-600">
                  No available slots found for the next 7 days.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {slots.map((slot) => {
                    const d = new Date(slot);
                    const isSelected = selectedSlot === slot;
                    return (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition-all ${
                          isSelected
                            ? "border-teal-400 bg-teal-50/80 text-teal-900 shadow-sm"
                            : "border-teal-100/40 bg-white/30 text-teal-700 hover:border-teal-200 hover:bg-white/50"
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5 flex-shrink-0 text-teal-500" />
                        <div>
                          <div className="font-medium">
                            {format(d, "EEE, MMM d")}
                          </div>
                          <div className="text-teal-600">
                            {format(d, "h:mm a")}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {selectedSlot && (
            <button
              onClick={handleBook}
              disabled={bookingLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-teal-500/20 transition-all hover:shadow-teal-500/30 disabled:opacity-50"
            >
              {bookingLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4" />
              )}
              {bookingLoading
                ? "Scheduling..."
                : "Confirm & Send Calendar Invite"}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
        </div>
      ) : (
        <div className="space-y-3">
          {interviews.map((i) => (
            <InterviewCard
              key={i.id}
              interview={i}
              onSendReminder={handleSendReminder}
              onDelete={handleDelete}
              reminderLoading={reminderLoading}
              deleteLoading={deleteLoading}
            />
          ))}
          {interviews.length === 0 && (
            <div className="glass rounded-2xl py-16 text-center">
              <Calendar className="mx-auto h-8 w-8 text-teal-300" />
              <p className="mt-3 text-sm font-medium text-teal-800">
                No upcoming interviews
              </p>
              <p className="mt-1 text-xs text-teal-600">
                Click &quot;Book Interview&quot; to schedule one
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
