import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

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
        "glass card-hover group relative overflow-hidden rounded-2xl px-5 py-4",
        className
      )}
    >
      {/* Subtle gradient accent on top */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-400/0 via-sky-400/40 to-sky-400/0" />

      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-sky-600">
            {title}
          </p>
          <p className="mt-1.5 text-2xl font-bold text-sky-950">{value}</p>
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-sky-600">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="rounded-xl bg-gradient-to-br from-sky-50 to-sky-100/60 p-2.5 transition-transform group-hover:scale-105">
            <Icon className="h-5 w-5 text-sky-500" />
          </div>
        )}
      </div>
    </div>
  );
}
