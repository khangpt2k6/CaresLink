"use client";

import { useEffect, useState } from "react";
import { InterviewCard } from "@/components/interview-card";
import { Calendar, Loader2 } from "lucide-react";

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

  useEffect(() => { fetchInterviews(); }, []);

  const handleSendReminder = async (interviewId: string) => {
    setReminderLoading(interviewId);
    try {
      const res = await fetch("/api/interviews/reminder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId }) });
      const data = await res.json();
      if (data.success) fetchInterviews();
      else alert(data.error || data.message || "Failed");
    } catch { alert("Failed to send reminder"); }
    finally { setReminderLoading(null); }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-teal-900">Interviews</h1>
        <p className="text-sm text-teal-700">Upcoming sessions & reminders</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
        </div>
      ) : (
        <div className="space-y-3">
          {interviews.map((i) => (
            <InterviewCard key={i.id} interview={i} onSendReminder={handleSendReminder} reminderLoading={reminderLoading} />
          ))}
          {interviews.length === 0 && (
            <div className="glass rounded-xl py-12 text-center">
              <Calendar className="mx-auto h-5 w-5 text-teal-500" />
              <p className="mt-2 text-sm text-teal-700">No upcoming interviews</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
