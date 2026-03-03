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
    <div className={cn("card px-5 py-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#9b9a97]">
            {title}
          </p>
          <p className="mt-1 text-2xl font-bold text-[#37352f]">{value}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-[#9b9a97]">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="rounded-lg bg-[#f7f7f5] p-2.5">
            <Icon className="h-5 w-5 text-[#9b9a97]" />
          </div>
        )}
      </div>
    </div>
  );
}
