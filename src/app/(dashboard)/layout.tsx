import { Sidebar } from "@/components/sidebar";
import { AiChatBubble } from "@/components/ai-chat-bubble";
import { RoleGate } from "@/components/role-gate";
import { PageWrapper } from "@/components/page-wrapper";
import { AiChatProvider } from "@/components/ai-chat-context";
import { DashboardContent } from "@/components/dashboard-content";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AiChatProvider>
      <RoleGate>
        <Sidebar />
        <DashboardContent>
          <PageWrapper>{children}</PageWrapper>
        </DashboardContent>
        <AiChatBubble />
      </RoleGate>
    </AiChatProvider>
  );
}
