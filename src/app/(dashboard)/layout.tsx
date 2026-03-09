import { Sidebar } from "@/components/sidebar";
import { AiChatBubble } from "@/components/ai-chat-bubble";
import { RoleGate } from "@/components/role-gate";
import { PageWrapper } from "@/components/page-wrapper";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGate>
      <Sidebar />
      <main className="min-h-screen bg-[#f5f7fa] pl-56">
        <PageWrapper>{children}</PageWrapper>
      </main>
      <AiChatBubble />
    </RoleGate>
  );
}
