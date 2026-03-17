"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, CheckCircle2, Loader2 } from "lucide-react";

interface Message {
  role: "assistant" | "user";
  content: string;
  timestamp: number;
}

export default function ScreeningPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const interviewId = params.interviewId as string;
  const email = searchParams.get("email") ?? "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [complete, setComplete] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [position, setPosition] = useState("");
  const [error, setError] = useState("");
  const [typingText, setTypingText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, typingText]);

  // Typewriter effect for AI messages
  const typeMessage = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      setIsTyping(true);
      setTypingText("");
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setTypingText(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setIsTyping(false);
          setTypingText("");
          resolve();
        }
      }, 12);
    });
  }, []);

  // Load existing screening state
  useEffect(() => {
    if (!email) {
      setError("Missing email parameter. Please use the link from your email.");
      setInitializing(false);
      return;
    }

    const init = async () => {
      try {
        const res = await fetch(`/api/screening/${interviewId}?email=${encodeURIComponent(email)}`);
        if (!res.ok) {
          setError("Screening not found. Please check your link.");
          setInitializing(false);
          return;
        }

        const data = await res.json();
        setCandidateName(data.candidate.name);
        setPosition(data.candidate.position);

        if (data.screening.status === "completed") {
          setMessages(data.screening.messages as Message[]);
          setComplete(true);
          setInitializing(false);
          return;
        }

        if ((data.screening.messages as Message[]).length > 0) {
          setMessages(data.screening.messages as Message[]);
          setInitializing(false);
          return;
        }

        // Start fresh — get AI greeting
        const chatRes = await fetch(`/api/screening/${interviewId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const chatData = await chatRes.json();

        const greeting: Message = {
          role: "assistant",
          content: chatData.message,
          timestamp: Date.now(),
        };

        setInitializing(false);
        await typeMessage(chatData.message);
        setMessages([greeting]);
      } catch {
        setError("Something went wrong. Please try again.");
        setInitializing(false);
      }
    };

    init();
  }, [interviewId, email, typeMessage]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading || complete) return;

    const userMsg: Message = { role: "user", content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`/api/screening/${interviewId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, email }),
      });
      const data = await res.json();

      await typeMessage(data.message);

      const aiMsg: Message = { role: "assistant", content: data.message, timestamp: Date.now() };
      setMessages((prev) => [...prev, aiMsg]);

      if (data.isComplete) {
        setComplete(true);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again.", timestamp: Date.now() },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa]">
        <div className="rounded-xl border border-[#e2e8f0] bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-sm text-[#5a6b7c]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7fa]">
      {/* Header */}
      <div className="border-b border-[#e2e8f0] bg-white px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f4fd]">
            <Bot className="h-5 w-5 text-[#0090d9]" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[#1a2b3c]">CaresLink Screening</h1>
            <p className="text-[11px] text-[#8a95a3]">
              {position ? `${position} — Pre-Interview Screening` : "Loading..."}
            </p>
          </div>
          {complete && (
            <div className="ml-auto flex items-center gap-1.5 rounded-full bg-[#e8f4fd] px-3 py-1 text-[11px] font-medium text-[#0090d9]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Complete
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4">
        <div className="flex-1 overflow-y-auto py-6">
          {initializing ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-[#0090d9]" />
              <p className="text-sm text-[#5a6b7c]">Setting up your screening...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                      msg.role === "assistant"
                        ? "bg-[#e8f4fd] text-[#0090d9]"
                        : "bg-[#1a2b3c] text-white"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <Bot className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      msg.role === "assistant"
                        ? "rounded-tl-md bg-white border border-[#e2e8f0] text-[#1a2b3c]"
                        : "rounded-tr-md bg-[#0090d9] text-white"
                    }`}
                  >
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {isTyping && typingText && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#e8f4fd] text-[#0090d9]">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="max-w-[75%] rounded-2xl rounded-tl-md border border-[#e2e8f0] bg-white px-4 py-2.5">
                    <p className="text-[13px] leading-relaxed text-[#1a2b3c]">
                      {typingText}
                      <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
                        className="ml-0.5 inline-block h-3.5 w-[2px] bg-[#0090d9] align-middle"
                      />
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Loading dots */}
              {loading && !isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#e8f4fd] text-[#0090d9]">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-[#e2e8f0] bg-white px-4 py-3">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                        className="h-1.5 w-1.5 rounded-full bg-[#0090d9]"
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        {!complete ? (
          <div className="border-t border-[#e2e8f0] bg-white px-4 py-3 rounded-t-xl">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your response..."
                disabled={loading || initializing}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-[#e2e8f0] bg-[#f5f7fa] px-4 py-2.5 text-[13px] text-[#1a2b3c] placeholder:text-[#b0bec8] focus:border-[#0090d9] focus:outline-none disabled:opacity-50"
                style={{ maxHeight: 120 }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 120) + "px";
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#0090d9] text-white transition-colors hover:bg-[#0077b6] disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-[#b0bec8]">
              This screening is conducted by AI. A recruiter will review your responses.
            </p>
          </div>
        ) : (
          <div className="border-t border-[#e2e8f0] bg-white px-6 py-5 rounded-t-xl text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-[#0090d9]" />
            <p className="mt-2 text-sm font-semibold text-[#1a2b3c]">Screening Complete</p>
            <p className="mt-1 text-xs text-[#8a95a3]">
              Thank you, {candidateName}! A recruiter will review your responses and follow up soon.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
