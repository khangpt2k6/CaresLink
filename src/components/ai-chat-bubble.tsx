"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  X,
  Send,
  Sparkles,
  Users,
  CalendarCheck,
  Clock,
  Mail,
  Trash2,
  Settings,
  Plus,
  ChevronDown,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const quickActions = [
  { icon: Users, label: "List all candidates", prompt: "List all candidates" },
  { icon: Mail, label: "Follow up stale candidates", prompt: "Check for stale candidates who haven't replied in 5+ days and send them a follow-up email" },
  { icon: CalendarCheck, label: "Show upcoming interviews", prompt: "List all upcoming interviews in the next 48 hours" },
  { icon: Clock, label: "Send reminders", prompt: "Send reminders for all interviews in the next 24 hours that haven't been reminded yet" },
  { icon: Settings, label: "Show my availability", prompt: "Show my current weekly availability schedule" },
];

interface ChatMessage {
  role: "user" | "ai";
  text: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

const STORAGE_KEY = "careslink-chat-sessions";
const ACTIVE_KEY = "careslink-chat-active-session";

function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 30)));
}

function getTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New Chat";
  const text = first.text.trim();
  return text.length > 40 ? text.slice(0, 40) + "…" : text;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function AiChatBubble() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(ACTIVE_KEY) || "";
  });
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // Get current session
  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;
  const messages = activeSession?.messages || [];

  // Save sessions to localStorage
  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  // Save active session id
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(ACTIVE_KEY, activeSessionId);
    }
  }, [activeSessionId]);

  // Migrate old single-session storage
  useEffect(() => {
    if (sessions.length === 0) {
      const oldMessages = localStorage.getItem("careslink-chat-messages");
      const oldSession = localStorage.getItem("careslink-chat-session");
      if (oldMessages && oldSession) {
        try {
          const msgs = JSON.parse(oldMessages) as ChatMessage[];
          if (msgs.length > 0) {
            const migrated: ChatSession = {
              id: oldSession,
              title: getTitle(msgs),
              messages: msgs,
              updatedAt: Date.now(),
            };
            setSessions([migrated]);
            setActiveSessionId(oldSession);
          }
        } catch { /* ignore */ }
        localStorage.removeItem("careslink-chat-messages");
        localStorage.removeItem("careslink-chat-session");
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 200);
    }
  }, [open]);

  // Close history dropdown on outside click
  useEffect(() => {
    if (!showHistory) return;
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showHistory]);

  const createNewChat = useCallback(() => {
    const id = crypto.randomUUID();
    setActiveSessionId(id);
    setShowHistory(false);
    setInput("");
  }, []);

  const switchToSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setShowHistory(false);
    setInput("");
  }, []);

  const updateSession = useCallback((sessionId: string, newMessages: ChatMessage[]) => {
    setSessions((prev) => {
      const existing = prev.find((s) => s.id === sessionId);
      if (existing) {
        return prev.map((s) =>
          s.id === sessionId
            ? { ...s, messages: newMessages.slice(-50), title: getTitle(newMessages), updatedAt: Date.now() }
            : s
        );
      }
      return [
        { id: sessionId, title: getTitle(newMessages), messages: newMessages.slice(-50), updatedAt: Date.now() },
        ...prev,
      ];
    });
  }, []);

  const deleteSession = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId("");
    }
  }, [activeSessionId]);

  const sendMessage = async (msg: string) => {
    if (!msg.trim() || loading) return;
    setInput("");

    // Ensure we have a session
    let sid = activeSessionId;
    if (!sid) {
      sid = crypto.randomUUID();
      setActiveSessionId(sid);
    }

    const newMessages = [...messages, { role: "user" as const, text: msg.trim() }];
    updateSession(sid, newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg.trim(), sessionId: sid }),
      });
      const data = await res.json();
      const withReply = [...newMessages, { role: "ai" as const, text: data.response || data.error || "No response" }];
      updateSession(sid, withReply);
    } catch {
      const withError = [...newMessages, { role: "ai" as const, text: "Failed to reach AI agent." }];
      updateSession(sid, withError);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const olderSessions = sessions
    .filter((s) => s.id !== activeSessionId && s.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <>
      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 right-0 z-50 flex h-full w-[460px] flex-col border-l border-[#e2e8f0] bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-[#0090d9] to-[#0077b6] px-5 py-4">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
                  transition={{ delay: 0.3, duration: 0.6, ease: "easeInOut" }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20"
                >
                  <Bot className="h-5 w-5 text-white" />
                </motion.div>
                <div>
                  <p className="text-[15px] font-semibold text-white">CaresLink AI</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" />
                    <p className="text-[11px] text-white/70">Recruitment Assistant</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={createNewChat}
                  className="rounded-lg p-2 text-white/60 hover:bg-white/15 hover:text-white transition-colors"
                  title="New chat"
                >
                  <Plus className="h-4 w-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-white/60 hover:bg-white/15 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>
            </div>

            {/* Chat Switcher Bar */}
            <div className="relative border-b border-[#e2e8f0] bg-[#fafbfc]" ref={historyRef}>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex w-full items-center justify-between px-5 py-2.5 text-left transition-colors hover:bg-[#f0f4f8]"
              >
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

              {/* History Dropdown */}
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 top-full z-10 max-h-[320px] overflow-y-auto border-b border-[#e2e8f0] bg-white shadow-lg"
                  >
                    {/* New Chat option */}
                    <button
                      onClick={createNewChat}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[#f0f7ff]"
                    >
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
                        <div className="px-5 py-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a95a3]">Older</p>
                        </div>
                        {olderSessions.map((session) => (
                          <div
                            key={session.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => switchToSession(session.id)}
                            onKeyDown={(e) => e.key === "Enter" && switchToSession(session.id)}
                            className="group flex w-full cursor-pointer items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-[#f5faff]"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0f4f8]">
                              <MessageSquare className="h-3.5 w-3.5 text-[#8a95a3]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-[#1a2b3c]">{session.title}</p>
                              <p className="text-[11px] text-[#b0bec8]">
                                {session.messages.length} messages · {timeAgo(session.updatedAt)}
                              </p>
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.15 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => deleteSession(session.id, e)}
                              className="rounded p-1 text-[#b0bec8] opacity-0 transition-opacity hover:bg-red-50 hover:text-red-400 group-hover:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </motion.button>
                          </div>
                        ))}
                      </>
                    )}

                    {olderSessions.length === 0 && (
                      <div className="px-5 py-4 text-center">
                        <p className="text-xs text-[#8a95a3]">No older conversations</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Messages Area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
            >
              <AnimatePresence initial={false}>
                {messages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.3 }}
                    className="flex flex-col items-center justify-center pt-6 pb-2 text-center"
                  >
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f4fd]">
                      <Sparkles className="h-7 w-7 text-[#0090d9]" />
                    </div>
                    <p className="text-base font-semibold text-[#1a2b3c]">Hi! How can I help?</p>
                    <p className="mt-1.5 text-sm text-[#8a95a3] max-w-[300px]">
                      I can manage candidates, schedule interviews, update your availability, and more.
                    </p>

                    {/* Quick Actions */}
                    <div className="mt-6 w-full space-y-2">
                      {quickActions.map((action, i) => (
                        <motion.button
                          key={action.label}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 + i * 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                          onClick={() => sendMessage(action.prompt)}
                          disabled={loading}
                          className="flex w-full items-center gap-3 rounded-xl border border-[#e2e8f0] px-4 py-3 text-left transition-all duration-150 hover:border-[#0090d9]/30 hover:bg-[#f5faff] hover:shadow-sm disabled:opacity-50"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e8f4fd]">
                            <action.icon className="h-4 w-4 text-[#0090d9]" />
                          </div>
                          <span className="text-sm text-[#1a2b3c]">{action.label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {m.role === "ai" && (
                      <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e8f4fd]">
                        <Bot className="h-3.5 w-3.5 text-[#0090d9]" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                        m.role === "user"
                          ? "bg-[#0090d9] text-white rounded-br-md"
                          : "bg-[#f5f7fa] text-[#1a2b3c] rounded-bl-md border border-[#e8ecf2]"
                      }`}
                    >
                      {m.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-start"
                >
                  <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e8f4fd]">
                    <Bot className="h-3.5 w-3.5 text-[#0090d9]" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-[#e8ecf2] bg-[#f5f7fa] px-4 py-3">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-[#8a95a3]"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ delay: i * 0.15, repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
                        />
                      ))}
                    </div>
                    <span className="text-[12px] text-[#8a95a3]">Thinking...</span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t border-[#e2e8f0] bg-[#fafbfc] px-4 py-3">
              <form onSubmit={handleSubmit} className="relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything... (Enter to send, Shift+Enter for new line)"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 pr-12 text-sm text-[#1a2b3c] placeholder:text-[#8a95a3] focus:border-[#0090d9] focus:outline-none focus:ring-2 focus:ring-[#0090d9]/20 transition-all"
                  disabled={loading}
                />
                <motion.button
                  type="submit"
                  disabled={loading || !input.trim()}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  className="absolute bottom-3 right-3 rounded-lg bg-[#0090d9] p-2 text-white hover:bg-[#0077b6] transition-colors disabled:opacity-30"
                >
                  <Send className="h-4 w-4" />
                </motion.button>
              </form>
              <p className="mt-2 text-center text-[10px] text-[#b0bec8]">
                Powered by Gemini AI &middot; CaresLink Agent v1
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#0090d9] text-white shadow-lg hover:bg-[#0077b6] transition-colors"
        style={{
          boxShadow: "0 4px 14px rgba(0, 144, 217, 0.45)",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={open ? "close" : "open"}
            initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
          </motion.div>
        </AnimatePresence>
      </motion.button>
    </>
  );
}
