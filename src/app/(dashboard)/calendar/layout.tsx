import { EmployerGate } from "@/components/employer-gate";

export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EmployerGate>{children}</EmployerGate>;
}
