"use client";

import { Sidebar } from "@/components/sidebar";
import { AiChatBubble } from "@/components/ai-chat-bubble";
import { RoleGate } from "@/components/role-gate";
import { PageWrapper } from "@/components/page-wrapper";
import { AiChatProvider, useAiChat } from "@/components/ai-chat-context";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { panelWidth } = useAiChat();

  return (
    <main
      className="min-h-screen bg-[#f5f7fa] pl-56 transition-[padding] duration-300 ease-in-out"
      style={{ paddingRight: panelWidth }}
    >
      <PageWrapper>{children}</PageWrapper>
    </main>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AiChatProvider>
      <RoleGate>
        <Sidebar />
        <DashboardContent>{children}</DashboardContent>
        <AiChatBubble />
      </RoleGate>
    </AiChatProvider>
  );
}
