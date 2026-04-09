"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Globe, Paperclip, ChevronDown, X, Plus, Check, Zap, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Model = {
  id: string;
  name: string;
  subtitle: string;
  requiresPro?: boolean;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const MODELS: Model[] = [
  { id: "claude-opus-4-6",           name: "Opus 4.6",   subtitle: "Most capable",   requiresPro: true },
  { id: "claude-sonnet-4-6",         name: "Sonnet 4.6", subtitle: "Best for most tasks" },
  { id: "claude-haiku-4-5-20251001", name: "Haiku 4.5",  subtitle: "Fastest replies" },
];

// Thinking modes — maps to thinkingBudget sent to API
// "fast" = 0 (disabled), "deep" = 8000 tokens budget
const THINKING_MODES = [
  { id: "fast",  label: "Fast",  icon: Zap,   budget: 0,    desc: "Quick replies, no extended thinking" },
  { id: "deep",  label: "Deep",  icon: Brain, budget: 8000, desc: "Extended thinking — slower but more thorough" },
] as const;
type ThinkingMode = "fast" | "deep";

const QUICK_ACTIONS = [
  { label: "Code",       prompt: "Help me write or debug some code" },
  { label: "Write",      prompt: "Help me write or improve content" },
  { label: "Learn",      prompt: "Explain a concept clearly" },
  { label: "Life stuff", prompt: "I need some general advice" },
  { label: "Brainstorm", prompt: "Help me brainstorm ideas" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, '<code class="bg-[#e8ecf2] rounded px-1 text-[13px] font-mono text-[#1a2b3c]">$1</code>')
    .replace(/\n/g, "<br/>");
}

// ── Model Picker ──────────────────────────────────────────────────────────────

function ModelPicker({ selected, onChange }: { selected: Model; onChange: (m: Model) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-[#d1d9e0] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1a2b3c] hover:bg-[#e8ecf2] transition-colors"
      >
        <Image src="/Claude_AI_symbol.svg" alt="Claude" width={13} height={13} />
        <span>{selected.name}</span>
        <ChevronDown className={cn("h-3 w-3 text-[#5a6b7c] transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full mb-2 right-0 w-64 rounded-xl border border-[#d1d9e0] bg-white shadow-lg overflow-hidden z-50"
          >
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => { onChange(m); setOpen(false); }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-[#f0f4f8] transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-[#1a2b3c]">
                    {m.name}
                    {m.requiresPro && (
                      <span className="rounded bg-[#0090d9]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#0090d9] uppercase tracking-wide">
                        Pro
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#5a6b7c] mt-0.5">{m.subtitle}</div>
                </div>
                {selected.id === m.id && <Check className="h-3.5 w-3.5 text-[#0090d9]" />}
              </button>
            ))}
            <div className="border-t border-[#e8ecf2] px-4 py-2.5 flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-[#1a2b3c]">Extended thinking</div>
                <div className="text-[11px] text-[#5a6b7c]">Think longer for complex tasks</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex gap-3", isUser && "flex-row-reverse")}
    >
      {!isUser && (
        <div className="flex-shrink-0 mt-0.5 h-7 w-7 rounded-full bg-[#e8ecf2] border border-[#d1d9e0] flex items-center justify-center">
          <Image src="/Claude_AI_symbol.svg" alt="Claude" width={14} height={14} />
        </div>
      )}

      <div className={cn("max-w-[72%]", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "rounded-xl px-4 py-2.5 text-[13px] leading-relaxed",
            isUser
              ? "bg-[#0090d9] text-white rounded-tr-sm"
              : "bg-white border border-[#e8ecf2] text-[#1a2b3c] shadow-sm rounded-tl-sm border-l-2 border-l-[#d97757]/40"
          )}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
        />
        <span className="text-[11px] text-[#94a3b8] px-1 mt-1">{formatTime(message.timestamp)}</span>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ClaudePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model>(MODELS[1]);
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>("fast");
  const [webSearch, setWebSearch] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [started, setStarted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [input]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text.trim(), timestamp: new Date() };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setAttachedFiles([]);
    setLoading(true);
    setStarted(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          sessionId: "claude-page",
          model: selectedModel.id,
          thinkingBudget: THINKING_MODES.find((m) => m.id === thinkingMode)?.budget ?? 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setMessages((p) => [...p, { id: crypto.randomUUID(), role: "assistant", content: data.response ?? "No response.", timestamp: new Date() }]);
    } catch (err: unknown) {
      setMessages((p) => [...p, { id: crypto.randomUUID(), role: "assistant", content: err instanceof Error ? err.message : "Something went wrong.", timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  return (
    <div className="p-6 h-[calc(100vh-2rem)] flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Image src="/Claude_AI_symbol.svg" alt="Claude" width={20} height={20} />
            <h1 className="text-xl font-bold text-[#1a2b3c]">Claude AI</h1>
          </div>
          <p className="text-sm text-[#5a6b7c] mt-0.5">Powered by Anthropic</p>
        </div>
        {started && (
          <button
            onClick={() => { setMessages([]); setStarted(false); setInput(""); }}
            className="flex items-center gap-1.5 rounded-lg border border-[#d1d9e0] bg-white px-3 py-1.5 text-[12px] font-medium text-[#5a6b7c] hover:bg-[#e8ecf2] hover:text-[#1a2b3c] transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            New chat
          </button>
        )}
      </div>

      {/* Chat card */}
      <div className="card flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {!started ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center h-full gap-5 pb-8"
            >
              <div className="h-14 w-14 rounded-full bg-[#e8ecf2] border border-[#d1d9e0] flex items-center justify-center">
                <Image src="/Claude_AI_symbol.svg" alt="Claude" width={28} height={28} />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-bold text-[#1a2b3c]">How can I help you today?</h2>
                <p className="text-sm text-[#5a6b7c] mt-1">Ask anything — code, writing, analysis, or anything else.</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_ACTIONS.map((a) => (
                  <button
                    key={a.label}
                    onClick={() => sendMessage(a.prompt)}
                    className="rounded-lg border border-[#d1d9e0] bg-white px-4 py-2 text-[12px] font-medium text-[#1a2b3c] hover:bg-[#e8ecf2] hover:border-[#0090d9] transition-all shadow-sm"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <>
              {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                  {/* Animated Claude GIF while loading */}
                  <div className="flex-shrink-0 mt-0.5 h-9 w-9 rounded-full bg-[#f5ede8] border border-[#e8d5cc] flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/claude_thinking.gif" alt="Claude thinking" width={28} height={28} />
                  </div>
                  <div className="bg-white border border-[#e8ecf2] rounded-xl rounded-tl-sm px-4 py-2.5 shadow-sm flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-[#1a2b3c]">
                      {thinkingMode === "deep" ? "Thinking deeply..." : "Thinking..."}
                    </span>
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="h-1 w-4 rounded-full bg-[#e8ecf2]"
                          animate={{ scaleX: [1, 1.6, 1], backgroundColor: ["#e8ecf2", "#0090d9", "#e8ecf2"] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-[#e8ecf2] px-4 py-3 flex-shrink-0">
          {/* Attached files */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {attachedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-lg bg-[#e8ecf2] border border-[#d1d9e0] px-2.5 py-1 text-[11px] text-[#1a2b3c]">
                  <span className="max-w-[100px] truncate">{f.name}</span>
                  <button onClick={() => setAttachedFiles((p) => p.filter((_, j) => j !== i))} className="text-[#5a6b7c] hover:text-[#dc2626]">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-[#d1d9e0] bg-[#f0f4f8] focus-within:border-[#0090d9] focus-within:bg-white transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={1}
              className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-[13px] text-[#1a2b3c] placeholder-[#94a3b8] outline-none min-h-[44px]"
            />
            <div className="flex items-center justify-between px-3 pb-2.5">
              <div className="flex items-center gap-1">
                {/* File attach */}
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { setAttachedFiles((p) => [...p, ...Array.from(e.target.files || [])]); e.target.value = ""; }} />
                <button onClick={() => fileInputRef.current?.click()} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#5a6b7c] hover:bg-[#e8ecf2] hover:text-[#1a2b3c] transition-colors" title="Attach files">
                  <Paperclip className="h-3.5 w-3.5" />
                </button>

                {/* Web search */}
                <button
                  onClick={() => setWebSearch((v) => !v)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors",
                    webSearch ? "bg-[#0090d9]/10 text-[#0090d9]" : "text-[#5a6b7c] hover:bg-[#e8ecf2] hover:text-[#1a2b3c]"
                  )}
                >
                  <Globe className="h-3 w-3" />
                  Web search
                  {webSearch && <Check className="h-2.5 w-2.5" />}
                </button>

                {/* Thinking mode toggle — only show for sonnet/opus */}
                {selectedModel.id !== "claude-haiku-4-5-20251001" && (
                  <div className="flex items-center rounded-lg border border-[#d1d9e0] overflow-hidden">
                    {THINKING_MODES.map((mode) => {
                      const Icon = mode.icon;
                      const active = thinkingMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          onClick={() => setThinkingMode(mode.id)}
                          title={mode.desc}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors",
                            active
                              ? mode.id === "deep"
                                ? "bg-[#1a2b3c] text-white"
                                : "bg-[#e8ecf2] text-[#1a2b3c]"
                              : "text-[#5a6b7c] hover:bg-[#f0f4f8]"
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <ModelPicker selected={selectedModel} onChange={setSelectedModel} />
                <motion.button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                    input.trim() && !loading ? "bg-[#0090d9] text-white hover:bg-[#0080c5]" : "bg-[#e8ecf2] text-[#94a3b8] cursor-not-allowed"
                  )}
                >
                  <Send className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            </div>
          </div>
          <p className="text-center text-[10px] text-[#94a3b8] mt-2">Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}
