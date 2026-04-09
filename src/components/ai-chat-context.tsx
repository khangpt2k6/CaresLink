"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { WIDTH_DEFAULT, WIDTH_EXPANDED } from "./ai-chat-constants";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "ai";
  text: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function storageKey(userId: string) {
  return `careslink-chat-sessions-${userId}`;
}
function activeKey(userId: string) {
  return `careslink-chat-active-${userId}`;
}

function loadSessions(userId: string): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[], userId: string) {
  localStorage.setItem(storageKey(userId), JSON.stringify(sessions.slice(0, 30)));
}

function getTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New Chat";
  const text = first.text.trim();
  return text.length > 40 ? text.slice(0, 40) + "..." : text;
}

// ── Context interface ─────────────────────────────────────────────────────────

interface AiChatState {
  // Panel open/expand state
  open: boolean;
  expanded: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  toggleExpand: () => void;
  panelWidth: number;

  // Shared session state
  sessions: ChatSession[];
  activeSessionId: string;
  activeSession: ChatSession | null;
  messages: ChatMessage[];
  loading: boolean;

  // Actions
  sendMessage: (text: string, model?: string) => Promise<void>;
  createNewChat: () => void;
  switchToSession: (id: string) => void;
  deleteSession: (id: string) => void;
}

const AiChatContext = createContext<AiChatState>({
  open: false,
  expanded: false,
  setOpen: () => {},
  toggle: () => {},
  toggleExpand: () => {},
  panelWidth: 0,
  sessions: [],
  activeSessionId: "",
  activeSession: null,
  messages: [],
  loading: false,
  sendMessage: async () => {},
  createNewChat: () => {},
  switchToSession: () => {},
  deleteSession: () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function AiChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const userId = user?.id ?? "";

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Ref for sessions to avoid stale closures in sendMessage
  const sessionsRef = useRef(sessions);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const toggleExpand = useCallback(() => setExpanded((v) => !v), []);
  const panelWidth = open ? (expanded ? WIDTH_EXPANDED : WIDTH_DEFAULT) : 0;

  // Load sessions from localStorage once userId is available
  useEffect(() => {
    if (!userId) return;
    const saved = loadSessions(userId);
    setSessions(saved);
    const savedActive = localStorage.getItem(activeKey(userId));
    if (savedActive) setActiveSessionId(savedActive);
  }, [userId]);

  // Save sessions whenever they change
  useEffect(() => {
    if (!userId) return;
    saveSessions(sessions, userId);
  }, [sessions, userId]);

  // Persist active session id
  useEffect(() => {
    if (!userId || !activeSessionId) return;
    localStorage.setItem(activeKey(userId), activeSessionId);
  }, [activeSessionId, userId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;
  const messages = activeSession?.messages || [];

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

  const sendMessage = useCallback(async (text: string, model = "claude-sonnet-4-6") => {
    if (!text.trim() || loading) return;

    let sid = activeSessionId;
    if (!sid) {
      sid = crypto.randomUUID();
      setActiveSessionId(sid);
    }

    const currentMessages = sessionsRef.current.find((s) => s.id === sid)?.messages || [];
    const newMessages = [...currentMessages, { role: "user" as const, text: text.trim() }];
    updateSession(sid, newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), sessionId: sid, model }),
      });
      const data = await res.json();
      const limitMessage =
        data?.code === "PLAN_RATE_LIMIT_MINUTE" ||
        data?.code === "PLAN_RATE_LIMIT_DAY" ||
        data?.code === "PLAN_BUDGET_LIMIT_MONTH"
          ? `AI limit reached for your ${data?.plan || "current"} plan. Go to Settings > Account > Billing to upgrade or wait for reset.`
          : null;
      updateSession(sid, [
        ...newMessages,
        { role: "ai" as const, text: limitMessage || data.response || data.error || "No response" },
      ]);
    } catch {
      updateSession(sid, [...newMessages, { role: "ai" as const, text: "Failed to reach AI agent." }]);
    } finally {
      setLoading(false);
    }
  }, [loading, activeSessionId, updateSession]);

  const createNewChat = useCallback(() => {
    setActiveSessionId(crypto.randomUUID());
  }, []);

  const switchToSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setActiveSessionId((prev) => (prev === id ? "" : prev));
  }, []);

  return (
    <AiChatContext.Provider
      value={{
        open, expanded, setOpen, toggle, toggleExpand, panelWidth,
        sessions, activeSessionId, activeSession, messages, loading,
        sendMessage, createNewChat, switchToSession, deleteSession,
      }}
    >
      {children}
    </AiChatContext.Provider>
  );
}

export function useAiChat() {
  return useContext(AiChatContext);
}
