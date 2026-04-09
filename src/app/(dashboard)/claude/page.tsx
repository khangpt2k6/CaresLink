"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, ChevronDown, X, Plus, Check,
  Sparkles, CalendarCheck,
  Users, Mail, Clock, ClipboardCheck, Globe, Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAiChat } from "@/components/ai-chat-context";

// ── Types ─────────────────────────────────────────────────────────────────────

type Model = { id: string; name: string; subtitle: string; requiresPro?: boolean };

// ── Constants ─────────────────────────────────────────────────────────────────

const MODELS: Model[] = [
  { id: "claude-opus-4-6",           name: "Opus 4.6",   subtitle: "Most capable",       requiresPro: true },
  { id: "claude-sonnet-4-6",         name: "Sonnet 4.6", subtitle: "Best for most tasks" },
  { id: "claude-haiku-4-5-20251001", name: "Haiku 4.5",  subtitle: "Fastest replies" },
];

const QUICK_ACTIONS = [
  { icon: Sparkles,       label: "Match candidates to jobs",   prompt: "Show me the top candidate matches for my open jobs" },
  { icon: CalendarCheck,  label: "Show upcoming interviews",    prompt: "List all upcoming interviews in the next 48 hours" },
  { icon: Users,          label: "Review candidates",          prompt: "List all candidates and their current status" },
  { icon: Mail,           label: "Follow up stale candidates", prompt: "Check for stale candidates who haven't replied in 5+ days and send them a follow-up email" },
  { icon: Clock,          label: "Send interview reminders",   prompt: "Send reminders for all interviews in the next 24 hours that haven't been reminded yet" },
  { icon: ClipboardCheck, label: "Run credential check",       prompt: "Run a credential verification for my latest candidates" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { elements.push(<div key={i} className="h-2" />); continue; }
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)/);
    const isBullet = !!bulletMatch;
    const content = isBullet ? bulletMatch![1] : line;
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) => {
      const boldMatch = part.match(/^\*\*(.+)\*\*$/);
      return boldMatch ? <strong key={j} className="font-semibold">{boldMatch[1]}</strong> : <span key={j}>{part}</span>;
    });
    elements.push(
      isBullet ? (
        <div key={i} className="flex gap-2 pl-1">
          <span className="text-[#0090d9] mt-px shrink-0">•</span>
          <span>{rendered}</span>
        </div>
      ) : <div key={i}>{rendered}</div>
    );
  }
  return <>{elements}</>;
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
        className="flex items-center gap-1.5 rounded-lg border border-[#d1d9e0] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1a2b3c] hover:bg-[#e8ecf2] transition-colors">
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
            className="absolute bottom-full mb-2 right-0 w-64 rounded-xl border border-[#d1d9e0] bg-white shadow-lg overflow-hidden z-50">
            {MODELS.map((m) => (
              <button key={m.id} onClick={() => { onChange(m); setOpen(false); }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-[#f0f4f8] transition-colors">
                <div>
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-[#1a2b3c]">
                    {m.name}
                    {m.requiresPro && (
                      <span className="rounded bg-[#0090d9]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#0090d9] uppercase tracking-wide">Pro</span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#5a6b7c] mt-0.5">{m.subtitle}</div>
                </div>
                {selected.id === m.id && <Check className="h-3.5 w-3.5 text-[#0090d9]" />}
              </button>
            ))}
            <div className="border-t border-[#e8ecf2] px-4 py-2.5">
              <div className="text-[13px] font-semibold text-[#1a2b3c]">Extended thinking</div>
              <div className="text-[11px] text-[#5a6b7c]">Think longer for complex tasks</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ClaudePage() {
  const { messages, loading, sendMessage, createNewChat } = useAiChat();

  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<Model>(MODELS[1]);
  const [webSearch, setWebSearch] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

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

  const handleSend = (text: string) => {
    if (!text.trim() || loading) return;
    sendMessage(text.trim(), selectedModel.id);
    setInput("");
    setAttachedFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(input); }
  };

  const started = messages.length > 0;

  return (
    <div className="p-6 h-[calc(100vh-2rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Image src="/Claude_AI_symbol.svg" alt="Claude" width={20} height={20} />
            <h1 className="text-xl font-bold text-[#1a2b3c]">Claude AI</h1>
          </div>
          <p className="text-sm text-[#5a6b7c] mt-0.5">Powered by Anthropic · CaresLink Recruitment Assistant</p>
        </div>
        {started && (
          <button onClick={createNewChat}
            className="flex items-center gap-1.5 rounded-lg border border-[#d1d9e0] bg-white px-3 py-1.5 text-[12px] font-medium text-[#5a6b7c] hover:bg-[#e8ecf2] hover:text-[#1a2b3c] transition-colors shadow-sm">
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
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center h-full gap-5 pb-8">
              <div className="h-14 w-14 rounded-full bg-[#e8ecf2] border border-[#d1d9e0] flex items-center justify-center">
                <Image src="/Claude_AI_symbol.svg" alt="Claude" width={28} height={28} />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-bold text-[#1a2b3c]">Good afternoon</h2>
                <p className="text-sm text-[#5a6b7c] mt-1">How can I help with your recruitment today?</p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-xl">
                {QUICK_ACTIONS.map((a) => (
                  <button key={a.label} onClick={() => handleSend(a.prompt)}
                    className="flex items-center gap-2.5 rounded-xl border border-[#d1d9e0] bg-white px-4 py-3 text-left text-[12px] font-medium text-[#1a2b3c] hover:bg-[#e8f4fd] hover:border-[#0090d9]/40 transition-all shadow-sm">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e8f4fd]">
                      <a.icon className="h-3.5 w-3.5 text-[#0090d9]" />
                    </div>
                    {a.label}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
                  {msg.role === "ai" && (
                    <div className="flex-shrink-0 mt-0.5 h-7 w-7 rounded-full bg-[#e8ecf2] border border-[#d1d9e0] flex items-center justify-center">
                      <Image src="/Claude_AI_symbol.svg" alt="Claude" width={14} height={14} />
                    </div>
                  )}
                  <div className={cn("max-w-[72%]", msg.role === "user" && "flex flex-col items-end")}>
                    <div className={cn(
                      "rounded-xl px-4 py-2.5 text-[13px] leading-relaxed",
                      msg.role === "user"
                        ? "bg-[#0090d9] text-white"
                        : "bg-white border border-[#e8ecf2] text-[#1a2b3c] shadow-sm"
                    )}>
                      {msg.role === "ai" ? renderMarkdown(msg.text) : msg.text}
                    </div>
                  </div>
                </motion.div>
              ))}
              {loading && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="flex justify-center py-8">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/claude_thinking.gif" alt="Claude thinking" width={56} height={56} style={{ imageRendering: "auto" }} />
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-[#e8ecf2] px-4 py-3 flex-shrink-0">
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
            <textarea ref={textareaRef} value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="How can I help you today?"
              rows={1}
              className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-[13px] text-[#1a2b3c] placeholder-[#94a3b8] outline-none min-h-[44px]" />
            <div className="flex items-center justify-between px-3 pb-2.5">
              <div className="flex items-center gap-1">
                <input ref={fileInputRef} type="file" multiple className="hidden"
                  onChange={(e) => { setAttachedFiles((p) => [...p, ...Array.from(e.target.files || [])]); e.target.value = ""; }} />
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#5a6b7c] hover:bg-[#e8ecf2] hover:text-[#1a2b3c] transition-colors" title="Attach files">
                  <Paperclip className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setWebSearch((v) => !v)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors",
                    webSearch ? "bg-[#0090d9]/10 text-[#0090d9]" : "text-[#5a6b7c] hover:bg-[#e8ecf2] hover:text-[#1a2b3c]"
                  )}>
                  <Globe className="h-3 w-3" />
                  Web search
                  {webSearch && <Check className="h-2.5 w-2.5" />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <ModelPicker selected={selectedModel} onChange={setSelectedModel} />
                <motion.button onClick={() => handleSend(input)} disabled={!input.trim() || loading}
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                    input.trim() && !loading ? "bg-[#0090d9] text-white hover:bg-[#0080c5]" : "bg-[#e8ecf2] text-[#94a3b8] cursor-not-allowed"
                  )}>
                  <Send className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            </div>
          </div>
          <p className="text-center text-[10px] text-[#94a3b8] mt-2">Shift+Enter for new line · Powered by Claude · CaresLink Agent</p>
        </div>
      </div>
    </div>
  );
}
