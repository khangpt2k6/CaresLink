import { cn } from "@/lib/utils";
import { LucideIcon, ChevronDown } from "lucide-react";
import { useState } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-[#e2e8f0] bg-white px-4 py-3",
        className
      )}
    >
      <div className="absolute left-0 top-0 h-full w-[2px] bg-[#0090d9]" />
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e8f4fd]">
            <Icon className="h-4 w-4 text-[#0090d9]" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a95a3]">
            {title}
          </p>
          <p className="text-lg font-bold leading-tight text-[#1a2b3c]">
            {value}
          </p>
        </div>
        {subtitle && (
          <p className="ml-auto shrink-0 text-[10px] text-[#8a95a3]">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export function MetricsSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8a95a3] transition-colors hover:text-[#0090d9]"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            !open && "-rotate-90"
          )}
        />
        Key Metrics
      </button>
      <div
        className={cn(
          "grid gap-3 sm:grid-cols-2 lg:grid-cols-4 transition-all duration-200 origin-top",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 h-0 overflow-hidden"
        )}
      >
        {children}
      </div>
    </div>
  );
}
