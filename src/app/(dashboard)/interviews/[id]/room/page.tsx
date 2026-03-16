"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  ArrowRight,
  TrendingUp,
  Shield,
  Target,
  Brain,
  Clock,
  User,
  Briefcase,
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

const CATEGORY_CONFIG: Record<
  string,
  { label: string; bg: string; border: string; text: string; iconBg: string; icon: React.ReactNode }
> = {
  strength: {
    label: "Strengths",
    bg: "bg-gradient-to-br from-emerald-50 to-emerald-50/40",
    border: "border-emerald-200/60",
    text: "text-emerald-700",
    iconBg: "bg-emerald-100",
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  },
  concern: {
    label: "Concerns",
    bg: "bg-gradient-to-br from-red-50 to-red-50/40",
    border: "border-red-200/60",
    text: "text-red-700",
    iconBg: "bg-red-100",
    icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
  },
  follow_up: {
    label: "Follow Up",
    bg: "bg-gradient-to-br from-amber-50 to-amber-50/40",
    border: "border-amber-200/60",
    text: "text-amber-700",
    iconBg: "bg-amber-100",
    icon: <Lightbulb className="h-3.5 w-3.5 text-amber-500" />,
  },
  general: {
    label: "General",
    bg: "bg-gradient-to-br from-[#e8f4fd] to-[#e8f4fd]/40",
    border: "border-[#0090d9]/15",
    text: "text-[#0077b6]",
    iconBg: "bg-[#e8f4fd]",
    icon: <MessageSquare className="h-3.5 w-3.5 text-[#0090d9]" />,
  },
};

const RECOMMENDATION_CONFIG: Record<string, { label: string; color: string; gradient: string; icon: React.ReactNode }> = {
  strong_hire: {
    label: "Strong Hire",
    color: "text-emerald-600",
    gradient: "from-emerald-500 to-teal-500",
    icon: <TrendingUp className="h-5 w-5" />,
  },
  hire: {
    label: "Hire",
    color: "text-[#0090d9]",
    gradient: "from-[#0090d9] to-[#0077b6]",
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  no_hire: {
    label: "No Hire",
    color: "text-red-500",
    gradient: "from-red-500 to-orange-500",
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  strong_no_hire: {
    label: "Strong No Hire",
    color: "text-red-600",
    gradient: "from-red-600 to-red-500",
    icon: <AlertTriangle className="h-5 w-5" />,
  },
};

function RatingBar({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[#8a95a3]">{icon}</span>
          <span className="text-[11px] font-medium text-[#5a6b7c]">{label}</span>
        </div>
        <span className="text-xs font-bold text-[#1a2b3c]">{value}/5</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(value / 5) * 100}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="h-full rounded-full bg-gradient-to-r from-[#0090d9] to-[#0077b6]"
        />
      </div>
    </div>
  );
}

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
};

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
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setInterview(d));

    fetch(`/api/interviews/${interviewId}/transcript`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setTranscripts(data);
      })
      .catch(console.error);

    fetch(`/api/interviews/${interviewId}/notes`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setNotes(data);
      })
      .catch(console.error);

    fetch(`/api/interviews/${interviewId}/summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.summary) {
          setSummary(data.summary);
          setEnded(true);
        }
      })
      .catch(console.error);
  }, [interviewId]);

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
      const res = await fetch(`/api/interviews/${interviewId}/deepgram-token`, { method: "POST", body: form });
      const data = await res.json();
      if (data.transcript) setTranscripts((prev) => [...prev, data.transcript]);
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
      recorder.start(1000);
      setIsRecording(true);
      timerRef.current = setInterval(() => setElapsedMs(Date.now() - startTimeRef.current), 1000);
      segmentTimerRef.current = setInterval(sendAudioChunk, 15000);
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
    setTimeout(sendAudioChunk, 500);
  }, [sendAudioChunk]);

  const handleEndInterview = async () => {
    stopRecording();
    setEnded(true);
    setSummaryLoading(true);
    setActiveTab("summary");
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

  const noteCountByCategory = {
    strength: notes.filter((n) => n.category === "strength").length,
    concern: notes.filter((n) => n.category === "concern").length,
    follow_up: notes.filter((n) => n.category === "follow_up").length,
    general: notes.filter((n) => n.category === "general").length,
  };

  return (
    <div className="flex h-screen flex-col bg-[#f5f7fa]">
      {/* ─── Header ─── */}
      <div className="relative z-10 flex items-center justify-between border-b border-[#e2e8f0] bg-white/80 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/interviews")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8a95a3] transition-all hover:bg-[#f0f4f8] hover:text-[#5a6b7c]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            {interview && (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0090d9] to-[#0077b6] text-xs font-bold text-white shadow-sm">
                {interview.candidate.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-sm font-semibold text-[#1a2b3c]">
                {interview ? interview.candidate.name : "Interview Room"}
              </h1>
              <p className="flex items-center gap-1.5 text-[11px] text-[#8a95a3]">
                <Briefcase className="h-3 w-3" />
                {interview?.position ?? "AI-Assisted Interview"}
                <span className="mx-1 text-[#e2e8f0]">|</span>
                <Brain className="h-3 w-3 text-[#0090d9]" />
                AI-Assisted
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3.5 py-1.5"
            >
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="h-2 w-2 rounded-full bg-red-500"
              />
              <span className="text-xs font-semibold tabular-nums text-red-600">
                {formatTime(elapsedMs)}
              </span>
            </motion.div>
          )}

          {!ended && (
            <>
              <select
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value as "interviewer" | "candidate")}
                className="rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-xs text-[#1a2b3c] transition-colors focus:border-[#0090d9] focus:outline-none focus:ring-2 focus:ring-[#0090d9]/10"
              >
                <option value="interviewer">Interviewer</option>
                <option value="candidate">Candidate</option>
              </select>

              {isRecording ? (
                <>
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                      isMuted
                        ? "bg-amber-100 text-amber-600 shadow-inner"
                        : "bg-[#f0f4f8] text-[#5a6b7c] hover:bg-[#e2e8f0]"
                    }`}
                  >
                    {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={handleEndInterview}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-red-500 to-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-105"
                  >
                    <Square className="h-3 w-3" /> End Interview
                  </button>
                </>
              ) : (
                <button
                  onClick={startRecording}
                  className="pulse-glow inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0090d9] to-[#0077b6] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-105"
                >
                  <Mic className="h-3.5 w-3.5" /> Start Recording
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── Main Content: Side-by-Side Layout ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Transcript */}
        <div className="flex w-1/2 flex-col border-r border-[#e2e8f0]">
          <div className="flex items-center gap-2 border-b border-[#e2e8f0] bg-white/60 px-5 py-3 backdrop-blur-sm">
            <FileText className="h-4 w-4 text-[#0090d9]" />
            <h2 className="text-xs font-semibold text-[#1a2b3c]">Live Transcript</h2>
            {transcripts.length > 0 && (
              <span className="rounded-full bg-[#e8f4fd] px-2 py-0.5 text-[10px] font-medium text-[#0090d9]">
                {transcripts.length} segments
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {transcripts.length === 0 ? (
              <motion.div {...fadeUp} className="flex flex-col items-center justify-center py-20">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f4fd]">
                  <Mic className="h-7 w-7 text-[#0090d9]" />
                </div>
                <p className="mt-4 text-sm font-medium text-[#1a2b3c]">
                  {isRecording ? "Listening... speak now" : "Waiting to record"}
                </p>
                <p className="mt-1 text-xs text-[#8a95a3]">
                  Transcripts appear automatically every 15 seconds
                </p>
              </motion.div>
            ) : (
              <div className="space-y-1">
                {transcripts.map((t, idx) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: idx > transcripts.length - 3 ? 0.1 : 0 }}
                    className="group flex gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/80"
                  >
                    <div
                      className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white shadow-sm ${
                        t.speaker === "interviewer"
                          ? "bg-gradient-to-br from-[#0090d9] to-[#0077b6]"
                          : "bg-gradient-to-br from-violet-500 to-purple-600"
                      }`}
                    >
                      {t.speaker === "interviewer" ? "I" : "C"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className="text-[11px] font-semibold capitalize text-[#1a2b3c]">
                          {t.speaker}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] text-[#b0bec8]">
                          <Clock className="h-2.5 w-2.5" />
                          {formatTime(t.timestampMs)}
                        </span>
                      </div>
                      <p className="text-[13px] leading-relaxed text-[#3a4b5c]">{t.content}</p>
                    </div>
                  </motion.div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Notes & Summary */}
        <div className="flex w-1/2 flex-col">
          {/* Right Tabs */}
          <div className="flex items-center gap-1 border-b border-[#e2e8f0] bg-white/60 px-5 py-2 backdrop-blur-sm">
            {(["notes", "summary"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium capitalize transition-all ${
                  activeTab === tab
                    ? "bg-[#0090d9]/8 text-[#0090d9]"
                    : "text-[#8a95a3] hover:bg-[#f0f4f8] hover:text-[#5a6b7c]"
                }`}
              >
                {tab === "notes" && <Sparkles className="h-3.5 w-3.5" />}
                {tab === "summary" && <Star className="h-3.5 w-3.5" />}
                {tab}
                {tab === "notes" && notes.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-[#0090d9] px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {notes.length}
                  </span>
                )}
              </button>
            ))}

            {activeTab === "notes" && (
              <button
                onClick={generateNotes}
                disabled={notesLoading || transcripts.length === 0}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[#0090d9]/20 bg-[#e8f4fd] px-3 py-1.5 text-[11px] font-medium text-[#0090d9] transition-all hover:bg-[#d0ebf9] disabled:opacity-40"
              >
                {notesLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {notesLoading ? "Analyzing..." : "Generate"}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <AnimatePresence mode="wait">
              {/* ─── Notes Panel ─── */}
              {activeTab === "notes" && (
                <motion.div key="notes" {...fadeUp}>
                  {notes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50">
                        <Sparkles className="h-7 w-7 text-violet-400" />
                      </div>
                      <p className="mt-4 text-sm font-medium text-[#1a2b3c]">No AI notes yet</p>
                      <p className="mt-1 text-xs text-[#8a95a3]">
                        Notes generate automatically during the interview
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Note count overview */}
                      <div className="grid grid-cols-4 gap-2">
                        {(["strength", "concern", "follow_up", "general"] as const).map((cat) => {
                          const cfg = CATEGORY_CONFIG[cat];
                          const count = noteCountByCategory[cat];
                          return (
                            <motion.div
                              key={cat}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.05 }}
                              className={`flex flex-col items-center gap-1 rounded-xl border ${cfg.border} ${cfg.bg} px-2 py-2.5`}
                            >
                              <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${cfg.iconBg}`}>
                                {cfg.icon}
                              </div>
                              <span className="text-base font-bold text-[#1a2b3c]">{count}</span>
                              <span className="text-[9px] font-medium uppercase tracking-wide text-[#8a95a3]">
                                {cfg.label}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* Note cards by category */}
                      {(["strength", "concern", "follow_up", "general"] as const).map((cat) => {
                        const catNotes = notes.filter((n) => n.category === cat);
                        if (catNotes.length === 0) return null;
                        const cfg = CATEGORY_CONFIG[cat];
                        return (
                          <div key={cat}>
                            <div className="mb-2.5 flex items-center gap-2">
                              <div className={`flex h-5 w-5 items-center justify-center rounded-md ${cfg.iconBg}`}>
                                {cfg.icon}
                              </div>
                              <span className="text-xs font-semibold text-[#1a2b3c]">{cfg.label}</span>
                              <span className="text-[10px] text-[#b0bec8]">{catNotes.length}</span>
                            </div>
                            <div className="space-y-1.5 pl-7">
                              {catNotes.map((note, ni) => (
                                <motion.div
                                  key={note.id}
                                  initial={{ opacity: 0, x: 8 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: ni * 0.04 }}
                                  className={`rounded-lg border ${cfg.border} ${cfg.bg} px-3.5 py-2.5 text-[12.5px] leading-relaxed ${cfg.text}`}
                                >
                                  {note.content}
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ─── Summary Panel ─── */}
              {activeTab === "summary" && (
                <motion.div key="summary" {...fadeUp}>
                  {summaryLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <div className="relative">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#0090d9]/10 to-[#0077b6]/10" />
                        <Loader2 className="absolute inset-0 m-auto h-7 w-7 animate-spin text-[#0090d9]" />
                      </div>
                      <p className="text-sm font-medium text-[#1a2b3c]">Analyzing interview...</p>
                      <p className="text-xs text-[#8a95a3]">Claude is generating the summary</p>
                    </div>
                  ) : !summary ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50">
                        <Star className="h-7 w-7 text-amber-400" />
                      </div>
                      <p className="mt-4 text-sm font-medium text-[#1a2b3c]">No summary yet</p>
                      <p className="mt-1 text-xs text-[#8a95a3]">
                        End the interview to generate a full AI summary
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Recommendation Hero */}
                      {(() => {
                        const rec = RECOMMENDATION_CONFIG[summary.recommendation];
                        return (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm"
                          >
                            <div className={`flex items-center gap-3 bg-gradient-to-r ${rec?.gradient ?? "from-gray-400 to-gray-500"} px-5 py-3.5 text-white`}>
                              {rec?.icon}
                              <div>
                                <p className="text-xs font-medium opacity-80">AI Recommendation</p>
                                <p className="text-base font-bold">{rec?.label ?? summary.recommendation}</p>
                              </div>
                            </div>
                            <div className="px-5 py-3.5">
                              <p className="text-[13px] leading-relaxed text-[#3a4b5c]">{summary.summary}</p>
                            </div>
                          </motion.div>
                        );
                      })()}

                      {/* Ratings */}
                      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
                        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#8a95a3]">
                          Performance Ratings
                        </h3>
                        <div className="space-y-3.5">
                          <RatingBar label="Technical Skills" value={summary.technicalRating} icon={<Target className="h-3.5 w-3.5" />} />
                          <RatingBar label="Communication" value={summary.communicationRating} icon={<MessageSquare className="h-3.5 w-3.5" />} />
                          <RatingBar label="Culture Fit" value={summary.cultureFitRating} icon={<Shield className="h-3.5 w-3.5" />} />
                          <RatingBar label="Overall" value={summary.overallRating} icon={<Star className="h-3.5 w-3.5" />} />
                        </div>
                      </div>

                      {/* Strengths & Concerns side by side */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-emerald-50/30 p-4">
                          <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Strengths
                          </h3>
                          <ul className="space-y-2">
                            {summary.strengths.map((s, i) => (
                              <motion.li
                                key={i}
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + i * 0.06 }}
                                className="flex items-start gap-2 text-[12px] leading-relaxed text-emerald-700"
                              >
                                <div className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-emerald-400" />
                                {s}
                              </motion.li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-red-200/60 bg-gradient-to-br from-red-50 to-red-50/30 p-4">
                          <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-600">
                            <AlertTriangle className="h-3.5 w-3.5" /> Concerns
                          </h3>
                          <ul className="space-y-2">
                            {summary.concerns.map((c, i) => (
                              <motion.li
                                key={i}
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + i * 0.06 }}
                                className="flex items-start gap-2 text-[12px] leading-relaxed text-red-700"
                              >
                                <div className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-red-400" />
                                {c}
                              </motion.li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Next Steps */}
                      {summary.nextSteps?.length > 0 && (
                        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                          <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8a95a3]">
                            <ArrowRight className="h-3.5 w-3.5 text-[#0090d9]" /> Recommended Next Steps
                          </h3>
                          <div className="space-y-2">
                            {summary.nextSteps.map((s, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 + i * 0.06 }}
                                className="flex items-start gap-2.5 rounded-lg bg-[#f5f7fa] px-3.5 py-2.5"
                              >
                                <div className="mt-0.5 flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded-full bg-[#0090d9]/10 text-[9px] font-bold text-[#0090d9]" style={{ width: 18, height: 18 }}>
                                  {i + 1}
                                </div>
                                <span className="text-[12px] leading-relaxed text-[#3a4b5c]">{s}</span>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
