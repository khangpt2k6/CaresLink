import { EmployerGate } from "@/components/employer-gate";

export default function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EmployerGate>{children}</EmployerGate>;
}
