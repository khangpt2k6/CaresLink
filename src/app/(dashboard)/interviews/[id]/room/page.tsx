"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  Square,
  Loader2,
  ChevronLeft,
  Sparkles,
  FileText,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  CheckCircle2,
  Star,
} from "lucide-react";

interface TranscriptSegment {
  id: string;
  speaker: string;
  content: string;
  timestampMs: number;
}

interface Note {
  id: string;
  content: string;
  category: string | null;
  source: string;
}

interface Summary {
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendation: string;
  technicalRating: number;
  communicationRating: number;
  cultureFitRating: number;
  overallRating: number;
  nextSteps: string[];
}

interface Interview {
  id: string;
  position: string;
  candidate: { name: string; email: string };
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  strength: { label: "Strength", color: "bg-emerald-50 border-emerald-200 text-emerald-800", icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> },
  concern: { label: "Concern", color: "bg-red-50 border-red-200 text-red-800", icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> },
  follow_up: { label: "Follow Up", color: "bg-amber-50 border-amber-200 text-amber-800", icon: <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> },
  general: { label: "General", color: "bg-blue-50 border-blue-200 text-blue-800", icon: <MessageSquare className="h-3.5 w-3.5 text-blue-500" /> },
};

const RECOMMENDATION_LABELS: Record<string, { label: string; color: string }> = {
  strong_hire: { label: "Strong Hire", color: "text-emerald-600 bg-emerald-50" },
  hire: { label: "Hire", color: "text-blue-600 bg-blue-50" },
  no_hire: { label: "No Hire", color: "text-red-600 bg-red-50" },
  strong_no_hire: { label: "Strong No Hire", color: "text-red-700 bg-red-100" },
};

function RatingDots({ value }: { value: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full ${i <= value ? "bg-[#0090d9]" : "bg-[#e2e8f0]"}`}
        />
      ))}
    </div>
  );
}

export default function InterviewRoomPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params.id as string;

  const [interview, setInterview] = useState<Interview | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptSegment[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speaker, setSpeaker] = useState<"interviewer" | "candidate">("interviewer");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [notesLoading, setNotesLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [ended, setEnded] = useState(false);
  const [activeTab, setActiveTab] = useState<"transcript" | "notes" | "summary">("transcript");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const segmentTimerRef = useRef<NodeJS.Timeout | null>(null);
  const notesTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Load interview details + existing data from DB
  useEffect(() => {
    fetch(`/api/interviews/${interviewId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setInterview(d));

    // Load existing transcripts
    fetch(`/api/interviews/${interviewId}/transcript`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setTranscripts(data);
      })
      .catch(console.error);

    // Load existing notes
    fetch(`/api/interviews/${interviewId}/notes`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setNotes(data);
      })
      .catch(console.error);

    // Load existing summary
    fetch(`/api/interviews/${interviewId}/summary`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.summary) {
          setSummary(data.summary);
          setEnded(true);
        }
      })
      .catch(console.error);
  }, [interviewId]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  const sendAudioChunk = useCallback(async () => {
    if (chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];

    const timestampMs = Date.now() - startTimeRef.current;
    const form = new FormData();
    form.append("audio", blob, "chunk.webm");
    form.append("speaker", speaker);
    form.append("timestampMs", String(timestampMs));

    try {
      const res = await fetch(`/api/interviews/${interviewId}/deepgram-token`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.transcript) {
        setTranscripts((prev) => [...prev, data.transcript]);
      }
    } catch (err) {
      console.error("Transcription error:", err);
    }
  }, [interviewId, speaker]);

  const generateNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/notes`, { method: "POST" });
      const data = await res.json();
      if (data.notes) setNotes(data.notes);
    } catch (err) {
      console.error("Notes error:", err);
    } finally {
      setNotesLoading(false);
    }
  }, [interviewId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(1000); // collect data every 1s
      setIsRecording(true);

      // Timer
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 1000);

      // Send audio every 15 seconds
      segmentTimerRef.current = setInterval(sendAudioChunk, 15000);

      // Generate AI notes every 60 seconds
      notesTimerRef.current = setInterval(generateNotes, 60000);
    } catch {
      alert("Microphone access denied. Please allow microphone access and try again.");
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (segmentTimerRef.current) clearInterval(segmentTimerRef.current);
    if (notesTimerRef.current) clearInterval(notesTimerRef.current);
    setIsRecording(false);
    // Send final chunk
    setTimeout(sendAudioChunk, 500);
  }, [sendAudioChunk]);

  const handleEndInterview = async () => {
    stopRecording();
    setEnded(true);
    setSummaryLoading(true);
    setActiveTab("summary");

    // Generate final notes first, then summary
    await generateNotes();

    try {
      const res = await fetch(`/api/interviews/${interviewId}/summary`, { method: "POST" });
      const data = await res.json();
      if (data.summary) setSummary(data.summary);
    } catch (err) {
      console.error("Summary error:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-[#f8fafc]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/interviews")}
            className="rounded-lg p-1.5 text-[#8a95a3] hover:bg-[#f0f4f8] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-[#1a2b3c]">
              {interview ? `${interview.candidate.name} — ${interview.position}` : "Interview Room"}
            </h1>
            <p className="text-xs text-[#8a95a3]">AI-Assisted Interview</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isRecording && (
            <div className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-xs font-medium text-red-600">{formatTime(elapsedMs)}</span>
            </div>
          )}

          {!ended && (
            <>
              <select
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value as "interviewer" | "candidate")}
                className="rounded-lg border border-[#e2e8f0] bg-white px-2 py-1.5 text-xs text-[#1a2b3c] focus:outline-none"
              >
                <option value="interviewer">Interviewer</option>
                <option value="candidate">Candidate</option>
              </select>

              {isRecording ? (
                <>
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`rounded-lg p-2 transition-colors ${isMuted ? "bg-amber-100 text-amber-600" : "bg-[#f0f4f8] text-[#5a6b7c] hover:bg-[#e2e8f0]"}`}
                  >
                    {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={handleEndInterview}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-xs font-medium text-white hover:bg-red-600 transition-colors"
                  >
                    <Square className="h-3.5 w-3.5" /> End Interview
                  </button>
                </>
              ) : (
                <button
                  onClick={startRecording}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0090d9] px-4 py-2 text-xs font-medium text-white hover:bg-[#0077b6] transition-colors"
                >
                  <Mic className="h-3.5 w-3.5" /> Start Recording
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#e2e8f0] bg-white px-6">
        {(["transcript", "notes", "summary"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-medium capitalize transition-colors ${
              activeTab === tab
                ? "border-[#0090d9] text-[#0090d9]"
                : "border-transparent text-[#8a95a3] hover:text-[#5a6b7c]"
            }`}
          >
            {tab === "transcript" && <FileText className="h-3.5 w-3.5" />}
            {tab === "notes" && <Sparkles className="h-3.5 w-3.5" />}
            {tab === "summary" && <Star className="h-3.5 w-3.5" />}
            {tab}
            {tab === "notes" && notes.length > 0 && (
              <span className="ml-1 rounded-full bg-[#0090d9] px-1.5 py-0.5 text-[10px] text-white">
                {notes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Transcript Tab */}
        {activeTab === "transcript" && (
          <div className="mx-auto max-w-3xl space-y-3">
            {transcripts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#c4cdd8] py-20 text-center">
                <Mic className="mx-auto h-8 w-8 text-[#c4cdd8]" />
                <p className="mt-3 text-sm font-medium text-[#1a2b3c]">
                  {isRecording ? "Listening... speak now" : "Start recording to begin transcription"}
                </p>
                <p className="mt-1 text-xs text-[#8a95a3]">
                  Transcript segments appear every 15 seconds
                </p>
              </div>
            ) : (
              transcripts.map((t) => (
                <div key={t.id} className="flex gap-3">
                  <div
                    className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                      t.speaker === "interviewer" ? "bg-[#0090d9]" : "bg-violet-500"
                    }`}
                  >
                    {t.speaker === "interviewer" ? "I" : "C"}
                  </div>
                  <div className="flex-1">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="text-xs font-medium capitalize text-[#1a2b3c]">
                        {t.speaker}
                      </span>
                      <span className="text-[10px] text-[#8a95a3]">
                        {formatTime(t.timestampMs)}
                      </span>
                    </div>
                    <p className="text-sm text-[#3a4b5c]">{t.content}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === "notes" && (
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs text-[#8a95a3]">
                AI notes auto-generate every 60 seconds during recording
              </p>
              <button
                onClick={generateNotes}
                disabled={notesLoading || transcripts.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0090d9] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0077b6] disabled:opacity-40 transition-colors"
              >
                {notesLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {notesLoading ? "Generating..." : "Generate Now"}
              </button>
            </div>

            {notes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#c4cdd8] py-20 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-[#c4cdd8]" />
                <p className="mt-3 text-sm font-medium text-[#1a2b3c]">No notes yet</p>
                <p className="mt-1 text-xs text-[#8a95a3]">
                  Notes appear automatically after enough transcript is collected
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {(["strength", "concern", "follow_up", "general"] as const).map((cat) => {
                  const catNotes = notes.filter((n) => n.category === cat);
                  if (catNotes.length === 0) return null;
                  const cfg = CATEGORY_CONFIG[cat];
                  return (
                    <div key={cat}>
                      <div className="mb-2 flex items-center gap-1.5">
                        {cfg.icon}
                        <span className="text-xs font-semibold text-[#5a6b7c]">{cfg.label}</span>
                      </div>
                      <div className="space-y-1.5">
                        {catNotes.map((note) => (
                          <div
                            key={note.id}
                            className={`rounded-lg border px-3 py-2 text-xs ${cfg.color}`}
                          >
                            {note.content}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Summary Tab */}
        {activeTab === "summary" && (
          <div className="mx-auto max-w-3xl">
            {summaryLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-[#0090d9]" />
                <p className="text-sm text-[#5a6b7c]">Generating AI summary...</p>
              </div>
            ) : !summary ? (
              <div className="rounded-xl border border-dashed border-[#c4cdd8] py-20 text-center">
                <Star className="mx-auto h-8 w-8 text-[#c4cdd8]" />
                <p className="mt-3 text-sm font-medium text-[#1a2b3c]">No summary yet</p>
                <p className="mt-1 text-xs text-[#8a95a3]">
                  Click &quot;End Interview&quot; to generate the AI summary
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Recommendation badge */}
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      RECOMMENDATION_LABELS[summary.recommendation]?.color ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {RECOMMENDATION_LABELS[summary.recommendation]?.label ?? summary.recommendation}
                  </span>
                </div>

                {/* Ratings */}
                <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
                  <h3 className="mb-3 text-xs font-semibold text-[#1a2b3c]">Ratings</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Technical", value: summary.technicalRating },
                      { label: "Communication", value: summary.communicationRating },
                      { label: "Culture Fit", value: summary.cultureFitRating },
                      { label: "Overall", value: summary.overallRating },
                    ].map((r) => (
                      <div key={r.label}>
                        <p className="mb-1 text-[10px] text-[#8a95a3]">{r.label}</p>
                        <RatingDots value={r.value} />
                        <p className="mt-0.5 text-xs font-medium text-[#1a2b3c]">{r.value}/5</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
                  <h3 className="mb-2 text-xs font-semibold text-[#1a2b3c]">Summary</h3>
                  <p className="text-sm text-[#3a4b5c]">{summary.summary}</p>
                </div>

                {/* Strengths & Concerns */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Strengths
                    </h3>
                    <ul className="space-y-1">
                      {summary.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-emerald-700">• {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-red-800">
                      <AlertTriangle className="h-3.5 w-3.5" /> Concerns
                    </h3>
                    <ul className="space-y-1">
                      {summary.concerns.map((c, i) => (
                        <li key={i} className="text-xs text-red-700">• {c}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Next Steps */}
                {summary.nextSteps?.length > 0 && (
                  <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#1a2b3c]">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Next Steps
                    </h3>
                    <ul className="space-y-1">
                      {summary.nextSteps.map((s, i) => (
                        <li key={i} className="text-xs text-[#5a6b7c]">• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
