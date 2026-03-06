"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2 } from "lucide-react";

export function AiChatBubble() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

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

  return (
    <>
      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 flex w-[380px] flex-col rounded-2xl border border-[#e2e8f0] bg-white shadow-2xl animate-in">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-[#0090d9] px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-white" />
              <div>
                <p className="text-sm font-semibold text-white">CaresLink AI</p>
                <p className="text-[10px] text-white/70">Recruitment Assistant</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 360, minHeight: 200 }}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bot className="h-8 w-8 text-[#d0e4f0] mb-2" />
                <p className="text-sm font-medium text-[#1a2b3c]">Hi! How can I help?</p>
                <p className="mt-1 text-xs text-[#8a95a3]">
                  Try: &quot;Contact Kevin Phan&quot; or &quot;List all candidates&quot;
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#0090d9] text-white rounded-br-md"
                      : "bg-[#f5f7fa] text-[#1a2b3c] rounded-bl-md"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-[#f5f7fa] px-3.5 py-2 text-[13px] text-[#8a95a3]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-[#e2e8f0] px-3 py-2.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-transparent text-sm text-[#1a2b3c] placeholder:text-[#8a95a3] focus:outline-none"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-full bg-[#0090d9] p-2 text-white hover:bg-[#0077b6] transition-colors disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#0090d9] text-white shadow-lg hover:bg-[#0077b6] transition-all hover:scale-105 active:scale-95"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </>
  );
}
