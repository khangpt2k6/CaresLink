"use client";

import { cn } from "@/lib/utils";
import { LucideIcon, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0);
  const prevTarget = useRef<number>(0);

  useEffect(() => {
    if (prevTarget.current === target) return;
    prevTarget.current = target;
    if (target === 0) { setVal(0); return; }
    let raf: number;
    const from = val;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (progress < 1) raf = requestAnimationFrame(step);
      else setVal(target);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return val;
}

function AnimatedValue({ value }: { value: string | number }) {
  const isNumber = typeof value === "number";
  const animated = useCountUp(isNumber ? value : 0);

  return (
    <motion.p
      key={String(value)}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="text-lg font-bold leading-tight text-[#1a2b3c] tabular-nums"
    >
      {isNumber ? animated : value}
    </motion.p>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  className?: string;
  index?: number;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  className,
  index = 0,
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.07,
        duration: 0.38,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-[#e2e8f0] bg-white px-4 py-3.5 cursor-default",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        "hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)] hover:border-[#0090d9]/20",
        "transition-shadow transition-[border-color] duration-200",
        className
      )}
    >
      <div className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-[#0090d9] to-[#0077b6]" />
      <div className="flex items-center gap-3">
        {Icon && (
          <motion.div
            whileHover={{ scale: 1.08, rotate: 4 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8f4fd]"
          >
            <Icon className="h-4 w-4 text-[#0090d9]" />
          </motion.div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a95a3]">
            {title}
          </p>
          <AnimatedValue value={value} />
        </div>
        {subtitle && (
          <p className="ml-auto shrink-0 text-[10px] text-[#8a95a3]">{subtitle}</p>
        )}
      </div>
    </motion.div>
  );
}

export function MetricsSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8a95a3] transition-colors hover:text-[#0090d9]"
      >
        <motion.div
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.div>
        Key Metrics
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pb-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
