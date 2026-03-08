import { EmployerGate } from "@/components/employer-gate";

export default function CandidatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EmployerGate>{children}</EmployerGate>;
}
