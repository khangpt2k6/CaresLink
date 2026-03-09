"use client";

import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const quickActions = [
  { icon: Users, label: "List all candidates", prompt: "List all candidates" },
  { icon: Mail, label: "Follow up stale candidates", prompt: "Check for stale candidates who haven't replied in 5+ days and send them a follow-up email" },
  { icon: CalendarCheck, label: "Show upcoming interviews", prompt: "List all upcoming interviews in the next 48 hours" },
  { icon: Clock, label: "Send reminders", prompt: "Send reminders for all interviews in the next 24 hours that haven't been reminded yet" },
  { icon: Settings, label: "Show my availability", prompt: "Show my current weekly availability schedule" },
];

export function AiChatBubble() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem("careslink-chat-messages");
    if (stored) {
      try { return JSON.parse(stored); } catch { return []; }
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionId = useRef<string>("");
  if (!sessionId.current) {
    const stored = typeof window !== "undefined" ? localStorage.getItem("careslink-chat-session") : null;
    if (stored) {
      sessionId.current = stored;
    } else {
      sessionId.current = crypto.randomUUID();
      if (typeof window !== "undefined") localStorage.setItem("careslink-chat-session", sessionId.current);
    }
  }

  // Save messages to localStorage on every change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("careslink-chat-messages", JSON.stringify(messages.slice(-50)));
    }
  }, [messages]);

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

  const sendMessage = async (msg: string) => {
    if (!msg.trim() || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: msg.trim() }]);
    setLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg.trim(), sessionId: sessionId.current }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: data.response || data.error || "No response" },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "Failed to reach AI agent." }]);
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

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem("careslink-chat-messages");
    localStorage.removeItem("careslink-chat-session");
    sessionId.current = crypto.randomUUID();
    localStorage.setItem("careslink-chat-session", sessionId.current);
  };

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
                  onClick={clearChat}
                  className="rounded-lg p-2 text-white/60 hover:bg-white/15 hover:text-white transition-colors"
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
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
