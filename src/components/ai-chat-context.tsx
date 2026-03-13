"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface AiChatState {
  open: boolean;
  expanded: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  toggleExpand: () => void;
  panelWidth: number;
}

const AiChatContext = createContext<AiChatState>({
  open: false,
  expanded: false,
  setOpen: () => {},
  toggle: () => {},
  toggleExpand: () => {},
  panelWidth: 0,
});

const WIDTH_DEFAULT = 370;
const WIDTH_EXPANDED = 540;

export function AiChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const toggleExpand = useCallback(() => setExpanded((v) => !v), []);
  const panelWidth = open ? (expanded ? WIDTH_EXPANDED : WIDTH_DEFAULT) : 0;

  return (
    <AiChatContext.Provider value={{ open, expanded, setOpen, toggle, toggleExpand, panelWidth }}>
      {children}
    </AiChatContext.Provider>
  );
}

export function useAiChat() {
  return useContext(AiChatContext);
}
