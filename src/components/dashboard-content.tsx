"use client";

import { useAiChat } from "./ai-chat-context";

export function DashboardContent({ children }: { children: React.ReactNode }) {
  const { panelWidth } = useAiChat();

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-[#f5f7fa] pl-56 transition-[padding] duration-300 ease-in-out"
      style={{ paddingRight: panelWidth }}
    >
      {children}
    </main>
  );
}
