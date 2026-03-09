"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Bot, X, Send, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function AiChatBubble() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const isCalendarPage = pathname === "/calendar" || pathname === "/availability";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
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

  if (isCalendarPage) return null;

  return (
    <>
      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="fixed bottom-20 right-6 z-50 flex w-[380px] flex-col rounded-2xl border border-[#e2e8f0] bg-white shadow-2xl overflow-hidden"
            style={{ transformOrigin: "bottom right" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-[#0090d9] to-[#0077b6] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
                  transition={{ delay: 0.3, duration: 0.6, ease: "easeInOut" }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20"
                >
                  <Bot className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
                </motion.div>
                <div>
                  <p className="text-sm font-semibold text-white">CaresLink AI</p>
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" />
                    <p className="text-[10px] text-white/70">Recruitment Assistant</p>
                  </div>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
              style={{ maxHeight: 340, minHeight: 180 }}
            >
              <AnimatePresence initial={false}>
                {messages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.3 }}
                    className="flex flex-col items-center justify-center py-8 text-center"
                  >
                    <Sparkles className="h-8 w-8 text-[#c8dff0] mb-2" />
                    <p className="text-sm font-medium text-[#1a2b3c]">Hi! How can I help?</p>
                    <p className="mt-1 text-xs text-[#8a95a3]">
                      Try: &quot;Contact Kevin Phan&quot; or &quot;List all candidates&quot;
                    </p>
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
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                        m.role === "user"
                          ? "bg-[#0090d9] text-white rounded-br-md"
                          : "bg-[#f5f7fa] text-[#1a2b3c] rounded-bl-md"
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
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-[#f5f7fa] px-3.5 py-2.5">
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
                    <span className="text-[12px] text-[#8a95a3]">Thinking</span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t border-[#e2e8f0] bg-[#fafbfc] px-3 py-2.5"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-transparent text-sm text-[#1a2b3c] placeholder:text-[#8a95a3] focus:outline-none"
                disabled={loading}
              />
              <motion.button
                type="submit"
                disabled={loading || !input.trim()}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                className="rounded-full bg-[#0090d9] p-2 text-white hover:bg-[#0077b6] transition-colors disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </motion.button>
            </form>
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
