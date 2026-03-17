"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  Clock,
  Brain,
  Briefcase,
} from "lucide-react";

/* ─── Types ─── */
interface TranscriptSegment { id: string; speaker: string; content: string; timestampMs: number }
interface Note { id: string; content: string; category: string | null; source: string }
interface Summary {
  summary: string; strengths: string[]; concerns: string[];
  recommendation: string; technicalRating: number; communicationRating: number;
  cultureFitRating: number; overallRating: number; nextSteps: string[];
}
interface Interview { id: string; position: string; candidate: { name: string; email: string } }

/* ─── Typewriter Effect ─── */
function TypewriterText({ text, speed = 18, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
        onDone?.();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, onDone]);

  return (
    <span>
      {displayed}
      {!done && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          className="inline-block w-[2px] h-3.5 bg-[#0090d9] ml-0.5 align-middle"
        />
      )}
    </span>
  );
}

/* ─── Live Waveform Visualizer ─── */
function LiveWaveform({ stream }: { stream: MediaStream | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      const w = canvasRef.current!.width;
      const h = canvasRef.current!.height;
      ctx.clearRect(0, 0, w, h);

      const barCount = 32;
      const barW = w / barCount - 1;
      for (let i = 0; i < barCount; i++) {
        const val = data[i] / 255;
        const barH = Math.max(2, val * h * 0.85);
        const x = i * (barW + 1);
        const y = (h - barH) / 2;
        ctx.fillStyle = `rgba(0, 144, 217, ${0.3 + val * 0.7})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 1);
        ctx.fill();
      }
    };
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      audioCtx.close();
    };
  }, [stream]);

  return <canvas ref={canvasRef} width={200} height={32} className="h-8 w-[200px]" />;
}

/* ─── Category config (platform-neutral icons, no colored backgrounds) ─── */
const CATEGORY_ICONS: Record<string, { label: string; icon: React.ReactNode }> = {
  strength: { label: "Strengths", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  concern: { label: "Concerns", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  follow_up: { label: "Follow Up", icon: <Lightbulb className="h-3.5 w-3.5" /> },
  general: { label: "General", icon: <MessageSquare className="h-3.5 w-3.5" /> },
};

const REC_LABELS: Record<string, string> = {
  strong_hire: "Strong Hire", hire: "Hire", no_hire: "No Hire", strong_no_hire: "Strong No Hire",
};

/* ─── Rating bar (platform blue only) ─── */
function RatingBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-[#5a6b7c]">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e2e8f0]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(value / 5) * 100}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="h-full rounded-full bg-[#0090d9]"
        />
      </div>
      <span className="w-6 text-right text-xs font-semibold text-[#1a2b3c]">{value}</span>
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
  const [activeTab, setActiveTab] = useState<"notes" | "summary">("notes");

  const [newSegmentIds, setNewSegmentIds] = useState<Set<string>>(new Set());
  const [streamRef, setStreamRef] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const segmentTimerRef = useRef<NodeJS.Timeout | null>(null);
  const notesTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);

  /* ─── Data loading ─── */
  useEffect(() => {
    fetch(`/api/interviews/${interviewId}`).then((r) => r.ok ? r.json() : null).then((d) => d && setInterview(d));
    fetch(`/api/interviews/${interviewId}/transcript`).then((r) => r.ok ? r.json() : []).then((d) => { if (Array.isArray(d) && d.length > 0) setTranscripts(d); }).catch(console.error);
    fetch(`/api/interviews/${interviewId}/notes`).then((r) => r.ok ? r.json() : []).then((d) => { if (Array.isArray(d) && d.length > 0) setNotes(d); }).catch(console.error);
    fetch(`/api/interviews/${interviewId}/summary`).then((r) => r.ok ? r.json() : null).then((d) => { if (d?.summary) { setSummary(d.summary); setEnded(true); } }).catch(console.error);
  }, [interviewId]);

  /* Smart auto-scroll: sticks to bottom unless user scrolled up */
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      isAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 80;
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isAutoScrollRef.current) {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcripts]);

  const fmt = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  /* ─── Recording logic ─── */
  const sendAudioChunk = useCallback(async () => {
    if (chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];
    const form = new FormData();
    form.append("audio", blob, "chunk.webm");
    form.append("speaker", speaker);
    form.append("timestampMs", String(Date.now() - startTimeRef.current));
    try {
      const res = await fetch(`/api/interviews/${interviewId}/deepgram-token`, { method: "POST", body: form });
      const data = await res.json();
      if (data.transcript) {
        setTranscripts((p) => [...p, data.transcript]);
        setNewSegmentIds((prev) => new Set(prev).add(data.transcript.id));
      }
    } catch (err) { console.error(err); }
  }, [interviewId, speaker]);

  const generateNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/notes`, { method: "POST" });
      const data = await res.json();
      if (data.notes) setNotes(data.notes);
    } catch (err) { console.error(err); }
    finally { setNotesLoading(false); }
  }, [interviewId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStreamRef(stream);
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(1000);
      setIsRecording(true);
      timerRef.current = setInterval(() => setElapsedMs(Date.now() - startTimeRef.current), 1000);
      segmentTimerRef.current = setInterval(sendAudioChunk, 15000);
      notesTimerRef.current = setInterval(generateNotes, 60000);
    } catch { alert("Microphone access denied."); }
  };

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    [timerRef, segmentTimerRef, notesTimerRef].forEach((r) => { if (r.current) clearInterval(r.current); });
    setIsRecording(false);
    setStreamRef(null);
    setTimeout(sendAudioChunk, 500);
  }, [sendAudioChunk]);

  const handleEndInterview = async () => {
    stopRecording(); setEnded(true); setSummaryLoading(true); setActiveTab("summary");
    await generateNotes();
    try {
      const res = await fetch(`/api/interviews/${interviewId}/summary`, { method: "POST" });
      const data = await res.json();
      if (data.summary) setSummary(data.summary);
    } catch (err) { console.error(err); }
    finally { setSummaryLoading(false); }
  };

  const notesByCategory = (cat: string) => notes.filter((n) => n.category === cat);

  return (
    <div className="flex h-screen flex-col bg-[#f5f7fa]">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/interviews")} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8a95a3] hover:bg-[#f0f4f8] transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {interview && (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8f4fd] text-xs font-semibold text-[#0090d9]">
              {interview.candidate.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-sm font-semibold text-[#1a2b3c]">
              {interview ? interview.candidate.name : "Interview Room"}
            </h1>
            <p className="flex items-center gap-1.5 text-[11px] text-[#8a95a3]">
              <Briefcase className="h-3 w-3" />
              {interview?.position ?? "Loading..."}
              <span className="text-[#e2e8f0]">|</span>
              <Brain className="h-3 w-3 text-[#0090d9]" />
              AI-Assisted
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {isRecording && (
            <div className="flex items-center gap-3 rounded-full border border-[#e2e8f0] bg-[#f5f7fa] px-3 py-1.5">
              <div className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </div>
              <LiveWaveform stream={streamRef} />
              <span className="text-xs font-semibold tabular-nums text-[#1a2b3c]">{fmt(elapsedMs)}</span>
            </div>
          )}
          {!ended && (
            <>
              <select
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value as "interviewer" | "candidate")}
                className="rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-xs text-[#1a2b3c] focus:border-[#0090d9] focus:outline-none"
              >
                <option value="interviewer">Interviewer</option>
                <option value="candidate">Candidate</option>
              </select>
              {isRecording ? (
                <>
                  <button onClick={() => setIsMuted(!isMuted)} className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${isMuted ? "bg-[#e8f4fd] text-[#0090d9]" : "bg-[#f0f4f8] text-[#5a6b7c] hover:bg-[#e2e8f0]"}`}>
                    {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <button onClick={handleEndInterview} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
                    <Square className="h-3 w-3" /> End
                  </button>
                </>
              ) : (
                <button onClick={startRecording} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0090d9] px-4 py-2 text-xs font-medium text-white hover:bg-[#0077b6] transition-colors">
                  <Mic className="h-3.5 w-3.5" /> Start Recording
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── Split Layout ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Transcript */}
        <div className="flex w-1/2 flex-col border-r border-[#e2e8f0]">
          <div className="flex items-center gap-2 border-b border-[#e2e8f0] bg-white px-5 py-2.5">
            <FileText className="h-3.5 w-3.5 text-[#0090d9]" />
            <span className="text-xs font-semibold text-[#1a2b3c]">Transcript</span>
            {transcripts.length > 0 && (
              <span className="text-[10px] text-[#8a95a3]">{transcripts.length} segments</span>
            )}
          </div>
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scroll-smooth">
            {transcripts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24">
                {isRecording ? (
                  <>
                    <div className="relative flex h-14 w-14 items-center justify-center">
                      <span className="absolute h-14 w-14 animate-ping rounded-full bg-[#0090d9]/10" />
                      <span className="absolute h-10 w-10 animate-pulse rounded-full bg-[#0090d9]/15" />
                      <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f4fd]">
                        <Mic className="h-5 w-5 text-[#0090d9]" />
                      </div>
                    </div>
                    <p className="mt-4 text-sm font-medium text-[#1a2b3c]">Listening...</p>
                    <div className="mt-2 flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                          className="h-1 w-1 rounded-full bg-[#0090d9]"
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-[#8a95a3]">Transcript appears in real-time</p>
                  </>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8f4fd]">
                      <Mic className="h-5 w-5 text-[#0090d9]" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-[#1a2b3c]">Ready to record</p>
                    <p className="mt-1 text-xs text-[#8a95a3]">Click &quot;Start Recording&quot; to begin</p>
                  </>
                )}
              </div>
            ) : (
              <div>
                {transcripts.map((t, idx) => {
                  const isNew = newSegmentIds.has(t.id);
                  const isLatest = idx === transcripts.length - 1;
                  return (
                    <motion.div
                      key={t.id}
                      initial={isNew ? { opacity: 0, y: 12, scale: 0.98 } : false}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className={`flex gap-3 border-b border-[#f0f4f8] px-5 py-3.5 transition-colors ${
                        isLatest && isRecording ? "bg-[#fafcff]" : "hover:bg-[#fafbfc]"
                      }`}
                    >
                      {/* Speaker avatar */}
                      <div className="relative mt-0.5">
                        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white ${
                          t.speaker === "interviewer" ? "bg-[#0090d9]" : "bg-[#5a6b7c]"
                        }`}>
                          {t.speaker === "interviewer" ? "I" : "C"}
                        </div>
                        {isLatest && isRecording && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#0090d9]">
                            <span className="absolute inset-0 animate-ping rounded-full bg-[#0090d9]/60" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-[11px] font-semibold capitalize text-[#1a2b3c]">{t.speaker}</span>
                          <span className="flex items-center gap-0.5 text-[10px] text-[#b0bec8]">
                            <Clock className="h-2.5 w-2.5" />{fmt(t.timestampMs)}
                          </span>
                          {isLatest && isNew && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="rounded-full bg-[#e8f4fd] px-1.5 py-0.5 text-[9px] font-medium text-[#0090d9]"
                            >
                              LIVE
                            </motion.span>
                          )}
                        </div>
                        <p className="text-[13px] leading-relaxed text-[#3a4b5c]">
                          {isNew && isLatest ? (
                            <TypewriterText
                              text={t.content}
                              speed={15}
                              onDone={() => setNewSegmentIds((prev) => {
                                const next = new Set(prev);
                                next.delete(t.id);
                                return next;
                              })}
                            />
                          ) : (
                            t.content
                          )}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Listening indicator at bottom while recording */}
                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 px-5 py-3 text-[#8a95a3]"
                  >
                    <div className="flex gap-0.5">
                      {[0, 1, 2, 3].map((i) => (
                        <motion.div
                          key={i}
                          animate={{ scaleY: [0.4, 1, 0.4] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                          className="h-3 w-[2px] origin-center rounded-full bg-[#0090d9]/40"
                        />
                      ))}
                    </div>
                    <span className="text-[11px]">Listening for next segment...</span>
                  </motion.div>
                )}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Right: Notes / Summary */}
        <div className="flex w-1/2 flex-col">
          <div className="flex items-center border-b border-[#e2e8f0] bg-white px-5 py-2.5">
            {(["notes", "summary"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  activeTab === tab ? "bg-[#e8f4fd] text-[#0090d9]" : "text-[#8a95a3] hover:text-[#5a6b7c]"
                }`}
              >
                {tab === "notes" && <Sparkles className="h-3.5 w-3.5" />}
                {tab === "summary" && <Star className="h-3.5 w-3.5" />}
                {tab}
                {tab === "notes" && notes.length > 0 && (
                  <span className="rounded-full bg-[#0090d9] px-1.5 py-0.5 text-[9px] font-bold text-white">{notes.length}</span>
                )}
              </button>
            ))}
            {activeTab === "notes" && (
              <button
                onClick={generateNotes}
                disabled={notesLoading || transcripts.length === 0}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-[11px] font-medium text-[#5a6b7c] hover:bg-[#f0f4f8] disabled:opacity-40 transition-colors"
              >
                {notesLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-[#0090d9]" />}
                {notesLoading ? "Analyzing..." : "Generate"}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <AnimatePresence mode="wait">
              {/* ─── Notes ─── */}
              {activeTab === "notes" && (
                <motion.div key="notes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  {notes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8f4fd]">
                        <Sparkles className="h-5 w-5 text-[#0090d9]" />
                      </div>
                      <p className="mt-3 text-sm font-medium text-[#1a2b3c]">No notes yet</p>
                      <p className="mt-1 text-xs text-[#8a95a3]">Notes auto-generate every 60s during recording</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Summary counts */}
                      <div className="grid grid-cols-4 gap-2">
                        {(["strength", "concern", "follow_up", "general"] as const).map((cat) => (
                          <div key={cat} className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2.5 text-center">
                            <p className="text-lg font-bold text-[#1a2b3c]">{notesByCategory(cat).length}</p>
                            <p className="text-[9px] font-medium uppercase tracking-wide text-[#8a95a3]">{CATEGORY_ICONS[cat].label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Note lists */}
                      {(["strength", "concern", "follow_up", "general"] as const).map((cat) => {
                        const items = notesByCategory(cat);
                        if (items.length === 0) return null;
                        const cfg = CATEGORY_ICONS[cat];
                        return (
                          <div key={cat}>
                            <div className="mb-2 flex items-center gap-2">
                              <span className="text-[#0090d9]">{cfg.icon}</span>
                              <span className="text-xs font-semibold text-[#1a2b3c]">{cfg.label}</span>
                              <span className="text-[10px] text-[#b0bec8]">{items.length}</span>
                            </div>
                            <div className="space-y-1.5">
                              {items.map((note, ni) => (
                                <motion.div
                                  key={note.id}
                                  initial={{ opacity: 0, x: 6 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: ni * 0.03 }}
                                  className="rounded-lg border border-[#e2e8f0] bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-[#3a4b5c]"
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

              {/* ─── Summary ─── */}
              {activeTab === "summary" && (
                <motion.div key="summary" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  {summaryLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-[#0090d9]" />
                      <p className="text-sm text-[#5a6b7c]">Generating summary...</p>
                    </div>
                  ) : !summary ? (
                    <div className="flex flex-col items-center justify-center py-24">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8f4fd]">
                        <Star className="h-5 w-5 text-[#0090d9]" />
                      </div>
                      <p className="mt-3 text-sm font-medium text-[#1a2b3c]">No summary yet</p>
                      <p className="mt-1 text-xs text-[#8a95a3]">End the interview to generate</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Recommendation */}
                      <div className="card px-4 py-3.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a95a3]">AI Recommendation</p>
                            <p className="mt-0.5 text-lg font-bold text-[#1a2b3c]">{REC_LABELS[summary.recommendation] ?? summary.recommendation}</p>
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f4fd]">
                            <Star className="h-5 w-5 text-[#0090d9]" />
                          </div>
                        </div>
                        <p className="mt-3 border-t border-[#e2e8f0] pt-3 text-[13px] leading-relaxed text-[#3a4b5c]">{summary.summary}</p>
                      </div>

                      {/* Ratings */}
                      <div className="card px-4 py-3.5">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#8a95a3]">Ratings</p>
                        <div className="space-y-2.5">
                          <RatingBar label="Technical" value={summary.technicalRating} />
                          <RatingBar label="Communication" value={summary.communicationRating} />
                          <RatingBar label="Culture Fit" value={summary.cultureFitRating} />
                          <RatingBar label="Overall" value={summary.overallRating} />
                        </div>
                      </div>

                      {/* Strengths & Concerns */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="card px-4 py-3.5">
                          <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8a95a3]">
                            <CheckCircle2 className="h-3 w-3 text-[#0090d9]" /> Strengths
                          </p>
                          <ul className="space-y-1.5">
                            {summary.strengths.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-[12px] leading-relaxed text-[#3a4b5c]">
                                <div className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-[#0090d9]" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="card px-4 py-3.5">
                          <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8a95a3]">
                            <AlertTriangle className="h-3 w-3 text-[#8a95a3]" /> Concerns
                          </p>
                          <ul className="space-y-1.5">
                            {summary.concerns.map((c, i) => (
                              <li key={i} className="flex items-start gap-2 text-[12px] leading-relaxed text-[#3a4b5c]">
                                <div className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-[#8a95a3]" />
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Next Steps */}
                      {summary.nextSteps?.length > 0 && (
                        <div className="card px-4 py-3.5">
                          <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8a95a3]">
                            <ArrowRight className="h-3 w-3 text-[#0090d9]" /> Next Steps
                          </p>
                          <div className="space-y-1.5">
                            {summary.nextSteps.map((s, i) => (
                              <div key={i} className="flex items-start gap-2.5 rounded-lg bg-[#f5f7fa] px-3 py-2">
                                <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#e8f4fd] text-[9px] font-bold text-[#0090d9]">{i + 1}</span>
                                <span className="text-[12px] leading-relaxed text-[#3a4b5c]">{s}</span>
                              </div>
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
