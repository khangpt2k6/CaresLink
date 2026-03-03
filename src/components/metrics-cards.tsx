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
        "glass card-hover rounded-xl px-4 py-3.5",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-teal-700">{title}</p>
          <p className="mt-1 text-xl font-semibold text-teal-950">{value}</p>
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-teal-600">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="rounded-lg bg-teal-50/60 p-2">
            <Icon className="h-4 w-4 text-teal-500" />
          </div>
        )}
      </div>
    </div>
  );
}
