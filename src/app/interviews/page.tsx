"use client";

import { useEffect, useState } from "react";
import { InterviewCard } from "@/components/interview-card";

interface Interview {
  id: string;
  position: string;
  scheduledAt: string;
  duration: number;
  reminderSent: boolean;
  candidate: { name: string; email: string; phone: string | null };
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);

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
      else alert(data.error || data.message || "Failed to send reminder");
    } catch (e) {
      alert("Failed to send reminder");
    } finally {
      setReminderLoading(null);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Interviews</h1>
        <p className="mt-1 text-slate-500">
          Upcoming interviews and reminders
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading...</div>
      ) : (
        <div className="space-y-4">
          {interviews.map((i) => (
            <InterviewCard
              key={i.id}
              interview={i}
              onSendReminder={handleSendReminder}
              reminderLoading={reminderLoading}
            />
          ))}
          {interviews.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
              No upcoming interviews
            </div>
          )}
        </div>
      )}
    </div>
  );
}
