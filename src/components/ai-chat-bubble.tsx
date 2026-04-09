"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  X,
  Send,
  Users,
  CalendarCheck,
  Clock,
  Mail,
  Trash2,
  Plus,
  ChevronDown,
  MessageSquare,
  ChevronsLeft,
  ChevronsRight,
  Check,
  Link2,
  ClipboardCheck,
  Sparkles,
  Maximize2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAiChat } from "./ai-chat-context";
import type { ChatSession } from "./ai-chat-context";
import {
  panelTransition,
  messageTransition,
  welcomeTransition,
  quickActionTransition,
  dropdownVariants,
  dropdownTransition,
  integrationsPanelVariants,
  integrationsPanelTransition,
  loadingDotAnimate,
  loadingDotTransition,
  buttonHover,
  buttonTap,
  fabHover,
  fabTap,
  sendHover,
  sendTap,
  deleteHover,
} from "./ai-chat-constants";

// ── Constants ─────────────────────────────────────────────────────────────────

const quickActions = [
  { icon: Sparkles,      label: "Match candidates to jobs",      prompt: "Show me the top candidate matches for my open jobs" },
  { icon: CalendarCheck, label: "Show upcoming interviews",       prompt: "List all upcoming interviews in the next 48 hours" },
  { icon: Users,         label: "List all candidates",            prompt: "List all candidates and their current status" },
  { icon: Mail,          label: "Follow up stale candidates",     prompt: "Check for stale candidates who haven't replied in 5+ days and send them a follow-up email" },
  { icon: Clock,         label: "Send interview reminders",       prompt: "Send reminders for all interviews in the next 24 hours that haven't been reminded yet" },
  { icon: ClipboardCheck,label: "Run credential check",           prompt: "Run a credential verification for my latest candidates" },
];

const integrations = [
  { id: "google-calendar", name: "Google Calendar", description: "Sync interviews & availability", logo: "/google-calendar.svg", connected: true },
  { id: "gmail",           name: "Gmail",           description: "Send emails to candidates",      logo: "/gmail_logo.jpg",       connected: true },
  { id: "outlook",         name: "Outlook",         description: "Microsoft 365 calendar & email", logo: "/outlook-icon.png",     connected: false },
  { id: "slack",           name: "Slack",           description: "Get notified on new applicants", logo: "/slack.png",            connected: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAiText(text: string) {
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
          <span className="text-[#0090d9] mt-px shrink-0">&#8226;</span>
          <span>{rendered}</span>
        </div>
      ) : (
        <div key={i}>{rendered}</div>
      )
    );
  }
  return <>{elements}</>;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AiChatBubble() {
  const pathname = usePathname();
  const {
    open, expanded, setOpen, toggle, toggleExpand, panelWidth,
    sessions, activeSessionId, activeSession, messages, loading,
    sendMessage, createNewChat, switchToSession, deleteSession,
  } = useAiChat();

  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // Hide the bubble entirely on the Claude AI full-page
  if (pathname === "/claude") return null;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (open && textareaRef.current) setTimeout(() => textareaRef.current?.focus(), 200);
  }, [open]);

  useEffect(() => {
    if (!showHistory) return;
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) setShowHistory(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showHistory]);

  const handleSend = () => { sendMessage(input); setInput(""); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); handleSend(); };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleCreateNew = () => { createNewChat(); setShowHistory(false); setShowIntegrations(false); setInput(""); };
  const handleSwitch = (id: string) => { switchToSession(id); setShowHistory(false); setInput(""); };

  const olderSessions = sessions
    .filter((s: ChatSession) => s.id !== activeSessionId && s.messages.length > 0)
    .sort((a: ChatSession, b: ChatSession) => b.updatedAt - a.updatedAt);

  return (
    <>
      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: panelWidth, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={panelTransition}
            className="fixed bottom-0 right-0 top-0 z-40 flex flex-col border-l border-[#e2e8f0] bg-white shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-[#0090d9] to-[#0077b6] px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <motion.button whileHover={buttonHover} whileTap={buttonTap} onClick={toggleExpand}
                  className="rounded-lg p-1 text-white/60 hover:bg-white/15 hover:text-white transition-colors"
                  title={expanded ? "Shrink panel" : "Expand panel"}>
                  {expanded ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
                </motion.button>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white overflow-hidden">
                  <Image src="/Claude_AI_symbol.svg" alt="Claude" width={20} height={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate">CaresLink AI</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" />
                    <p className="text-[10px] text-white/70">Recruitment Assistant</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {/* Open full page */}
                <motion.button whileHover={buttonHover} whileTap={buttonTap}
                  onClick={() => { setOpen(false); window.location.href = "/claude"; }}
                  className="rounded-lg p-1 text-white/60 hover:bg-white/15 hover:text-white transition-colors"
                  title="Open full page">
                  <Maximize2 className="h-3.5 w-3.5" />
                </motion.button>
                <motion.button whileHover={buttonHover} whileTap={buttonTap}
                  onClick={() => { setShowIntegrations(!showIntegrations); setShowHistory(false); }}
                  className={`rounded-lg p-1 transition-colors ${showIntegrations ? "bg-white/25 text-white" : "text-white/60 hover:bg-white/15 hover:text-white"}`}
                  title="Integrations">
                  <Link2 className="h-3.5 w-3.5" />
                </motion.button>
                <motion.button whileHover={buttonHover} whileTap={buttonTap} onClick={handleCreateNew}
                  className="rounded-lg p-1 text-white/60 hover:bg-white/15 hover:text-white transition-colors" title="New chat">
                  <Plus className="h-3.5 w-3.5" />
                </motion.button>
                <motion.button whileHover={buttonHover} whileTap={buttonTap} onClick={() => setOpen(false)}
                  className="rounded-lg p-1 text-white/60 hover:bg-white/15 hover:text-white transition-colors" title="Close panel">
                  <X className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            </div>

            {/* Integrations Panel */}
            <AnimatePresence>
              {showIntegrations && (
                <motion.div initial="hidden" animate="visible" exit="hidden"
                  variants={integrationsPanelVariants} transition={integrationsPanelTransition}
                  className="overflow-hidden border-b border-[#e2e8f0] bg-[#fafbfc]">
                  <div className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#1a2b3c]">Connected Tools</p>
                      <span className="text-[10px] text-[#8a95a3]">{integrations.filter((i) => i.connected).length}/{integrations.length} active</span>
                    </div>
                    <div className="space-y-2">
                      {integrations.map((integration) => (
                        <div key={integration.id} className="flex items-center gap-3 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2.5 transition-colors hover:border-[#0090d9]/20">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f5f7fa] overflow-hidden">
                            <img src={integration.logo} alt={integration.name} className="h-5 w-5 object-contain" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[#1a2b3c]">{integration.name}</p>
                            <p className="text-[11px] text-[#8a95a3]">{integration.description}</p>
                          </div>
                          {integration.connected ? (
                            <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600">
                              <Check className="h-3 w-3" /> Connected
                            </span>
                          ) : (
                            <button className="rounded-lg bg-[#0090d9] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#0077b6] transition-colors">Connect</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat Switcher Bar */}
            <div className="relative border-b border-[#e2e8f0] bg-[#fafbfc]" ref={historyRef}>
              <button
                onClick={() => { setShowHistory(!showHistory); setShowIntegrations(false); }}
                className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-[#f0f4f8]">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[#0090d9]" />
                  <span className="truncate text-sm font-medium text-[#1a2b3c]">
                    {activeSession ? activeSession.title : "New Chat"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {olderSessions.length > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#0090d9]/10 px-1.5 text-[10px] font-semibold text-[#0090d9]">
                      {olderSessions.length}
                    </span>
                  )}
                  <ChevronDown className={`h-3.5 w-3.5 text-[#8a95a3] transition-transform ${showHistory ? "rotate-180" : ""}`} />
                </div>
              </button>

              <AnimatePresence>
                {showHistory && (
                  <motion.div initial="hidden" animate="visible" exit="hidden"
                    variants={dropdownVariants} transition={dropdownTransition}
                    className="absolute left-0 right-0 top-full z-10 max-h-[320px] overflow-y-auto border-b border-[#e2e8f0] bg-white shadow-lg">
                    <button onClick={handleCreateNew}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#f0f7ff]">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e8f4fd]">
                        <Plus className="h-4 w-4 text-[#0090d9]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#0090d9]">New Chat</p>
                        <p className="text-[11px] text-[#8a95a3]">Start a fresh conversation</p>
                      </div>
                    </button>

                    {olderSessions.length > 0 && (
                      <>
                        <div className="px-4 py-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a95a3]">Older</p>
                        </div>
                        {olderSessions.map((session: ChatSession) => (
                          <div key={session.id} role="button" tabIndex={0}
                            onClick={() => handleSwitch(session.id)}
                            onKeyDown={(e) => e.key === "Enter" && handleSwitch(session.id)}
                            className="group flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-[#f5faff]">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0f4f8]">
                              <MessageSquare className="h-3.5 w-3.5 text-[#8a95a3]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-[#1a2b3c]">{session.title}</p>
                              <p className="text-[11px] text-[#b0bec8]">
                                {session.messages.length} messages · {timeAgo(session.updatedAt)}
                              </p>
                            </div>
                            <motion.button whileHover={deleteHover} whileTap={buttonTap}
                              onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                              className="rounded p-1 text-[#b0bec8] opacity-0 transition-opacity hover:bg-red-50 hover:text-red-400 group-hover:opacity-100">
                              <Trash2 className="h-3.5 w-3.5" />
                            </motion.button>
                          </div>
                        ))}
                      </>
                    )}

                    {olderSessions.length === 0 && (
                      <div className="px-4 py-4 text-center">
                        <p className="text-xs text-[#8a95a3]">No older conversations</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              <AnimatePresence initial={false}>
                {messages.length === 0 && !showIntegrations && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={welcomeTransition}
                    className="flex flex-col items-center justify-center pt-4 pb-2 text-center">
                    <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f4fd] overflow-hidden">
                      <Image src="/Claude_AI_symbol.svg" alt="Claude" width={28} height={28} />
                    </div>
                    <p className="text-sm font-semibold text-[#1a2b3c]">Hi! How can I help?</p>
                    <p className="mt-1 text-xs text-[#8a95a3] max-w-[260px]">
                      I can manage candidates, schedule interviews, verify credentials, match candidates to jobs, and more.
                    </p>
                    <div className="mt-4 w-full space-y-1.5">
                      {quickActions.map((action, i) => (
                        <motion.button key={action.label}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          transition={quickActionTransition(i)}
                          onClick={() => { sendMessage(action.prompt); }}
                          disabled={loading}
                          className="flex w-full items-center gap-2.5 rounded-lg border border-[#e2e8f0] px-3 py-2 text-left transition-all duration-150 hover:border-[#0090d9]/30 hover:bg-[#f5faff] hover:shadow-sm disabled:opacity-50">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#e8f4fd]">
                            <action.icon className="h-3.5 w-3.5 text-[#0090d9]" />
                          </div>
                          <span className="text-xs text-[#1a2b3c]">{action.label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
                {messages.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={messageTransition} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "ai" && (
                      <div className="mr-1.5 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#e8f4fd] overflow-hidden">
                        <Image src="/Claude_AI_symbol.svg" alt="Claude" width={14} height={14} />
                      </div>
                    )}
                    <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-[#0090d9] text-white rounded-br-md whitespace-pre-wrap"
                        : "bg-[#f5f7fa] text-[#1a2b3c] rounded-bl-md border border-[#e8ecf2]"
                    }`}>
                      {m.role === "ai" ? formatAiText(m.text) : m.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {loading && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex justify-start">
                  <div className="mr-1.5 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#e8f4fd] overflow-hidden">
                    <Image src="/Claude_AI_symbol.svg" alt="Claude" width={14} height={14} />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-[#e8ecf2] bg-[#f5f7fa] px-3 py-2">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-[#8a95a3]"
                          animate={loadingDotAnimate} transition={loadingDotTransition(i)} />
                      ))}
                    </div>
                    <span className="text-[12px] text-[#8a95a3]">Thinking...</span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t border-[#e2e8f0] bg-[#fafbfc] px-3 py-2.5">
              <form onSubmit={handleSubmit} className="relative">
                <textarea
                  ref={textareaRef} value={input}
                  onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="Ask anything... (Enter to send)" rows={2}
                  className="w-full resize-none rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 pr-10 text-xs text-[#1a2b3c] placeholder:text-[#8a95a3] focus:border-[#0090d9] focus:outline-none focus:ring-2 focus:ring-[#0090d9]/20 transition-all"
                  disabled={loading} />
                <motion.button type="submit" disabled={loading || !input.trim()}
                  whileHover={sendHover} whileTap={sendTap}
                  className="absolute bottom-2 right-2 rounded-md bg-[#0090d9] p-1.5 text-white hover:bg-[#0077b6] transition-colors disabled:opacity-30">
                  <Send className="h-3.5 w-3.5" />
                </motion.button>
              </form>
              <p className="mt-1.5 text-center text-[9px] text-[#b0bec8]">
                Powered by Claude · CaresLink Agent v1
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      {!open && (
        <motion.button onClick={toggle} whileHover={fabHover} whileTap={fabTap}
          className="fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg hover:shadow-xl transition-shadow overflow-hidden ring-1 ring-black/5"
          style={{ boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)" }}>
          <Image src="/Claude_AI_symbol.svg" alt="Claude" width={32} height={32} />
        </motion.button>
      )}
    </>
  );
}
