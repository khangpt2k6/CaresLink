"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { User, Mail, Phone, Briefcase, Calendar, Clock, Loader2 } from "lucide-react";

interface BookingFormProps {
  selectedSlot: string;
  onSubmit: (data: {
    name: string;
    email: string;
    phone: string;
    position: string;
  }) => void;
  submitting: boolean;
  error: string | null;
  hideTimeSummary?: boolean;
  initialEmail?: string;
}

const inputClass =
  "w-full rounded-lg border border-[#e2e8f0] bg-white px-3.5 py-2.5 text-sm text-[#1a2b3c] placeholder:text-[#8a95a3] transition-all duration-200 focus:border-[#0090d9] focus:outline-none focus:ring-2 focus:ring-[#0090d9]/20";

const readOnlyInputClass =
  "w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-2.5 text-sm text-[#5a6b7c] cursor-default";

const fieldVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  }),
};

export function BookingForm({
  selectedSlot,
  onSubmit,
  submitting,
  error,
  hideTimeSummary,
  initialEmail,
}: BookingFormProps) {
  const [form, setForm] = useState({
    name: "",
    email: initialEmail || "",
    phone: "",
    position: "",
  });
  const [lookupLoading, setLookupLoading] = useState(false);

  const fetchCandidateByEmail = useCallback(async (email: string) => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) return;
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/booking/lookup?email=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.found && data.candidate) {
        setForm((f) => ({
          ...f,
          name: data.candidate.name || f.name,
          phone: data.candidate.phone || "",
          position: data.candidate.position || "",
        }));
      }
    } catch {
      /* ignore */
    } finally {
      setLookupLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialEmail) fetchCandidateByEmail(initialEmail);
  }, [initialEmail, fetchCandidateByEmail]);

  const handleEmailBlur = () => {
    if (form.email.trim()) fetchCandidateByEmail(form.email);
  };

  const d = new Date(selectedSlot);
  const isValid = form.name.trim() && form.email.trim() && form.email.includes("@");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSubmit(form);
  };

  const hasPrefilledData = !!(form.phone || form.position);

  return (
    <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4 sm:gap-5">
      {!hideTimeSummary && (
        <motion.div
          custom={0}
          variants={fieldVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-wrap items-center gap-4 rounded-xl border border-[#e2e8f0] bg-[#e8f4fd]/50 px-4 py-3.5 text-sm text-[#1a2b3c]"
        >
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#0090d9]" />
            {format(d, "EEEE, MMMM d, yyyy")}
          </span>
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#0090d9]" />
            {format(d, "h:mm a")}
          </span>
        </motion.div>
      )}

      {/* Name - always editable */}
      <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible" className="flex flex-col gap-1.5">
        <label className="flex items-center gap-1.5 text-xs font-medium text-[#5a6b7c]">
          <User className="h-3.5 w-3.5 text-[#0090d9]" /> Name <span className="text-[#ef4444]">*</span>
        </label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className={inputClass}
          placeholder="Your full name"
        />
      </motion.div>

      {/* Email - always editable; triggers lookup on blur */}
      <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible" className="flex flex-col gap-1.5">
        <label className="flex items-center gap-1.5 text-xs font-medium text-[#5a6b7c]">
          <Mail className="h-3.5 w-3.5 text-[#0090d9]" /> Email <span className="text-[#ef4444]">*</span>
        </label>
        <div className="relative">
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            onBlur={handleEmailBlur}
            className={inputClass}
            placeholder="you@example.com"
          />
          {lookupLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-[#0090d9]" />
            </span>
          )}
        </div>
      </motion.div>

      {/* Phone & Position - read-only when fetched from DB */}
      {hasPrefilledData && (
        <>
          <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible" className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[#5a6b7c]">
              <Phone className="h-3.5 w-3.5 text-[#0090d9]" /> Phone
            </label>
            <input type="text" value={form.phone || "—"} readOnly className={readOnlyInputClass} />
          </motion.div>
          <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible" className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[#5a6b7c]">
              <Briefcase className="h-3.5 w-3.5 text-[#0090d9]" /> Position
            </label>
            <input type="text" value={form.position || "—"} readOnly className={readOnlyInputClass} />
          </motion.div>
        </>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3.5 py-2.5 text-sm text-[#dc2626]"
        >
          {error}
        </motion.p>
      )}

      <motion.button
        type="submit"
        disabled={!isValid || submitting}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0090d9] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#0090d9]/25 transition-all duration-200 hover:bg-[#0077b6] hover:shadow-xl hover:shadow-[#0090d9]/30 disabled:opacity-50 disabled:shadow-none"
        whileHover={!submitting && isValid ? { scale: 1.02 } : {}}
        whileTap={!submitting && isValid ? { scale: 0.98 } : {}}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Scheduling...
          </>
        ) : (
          "Schedule Interview"
        )}
      </motion.button>
    </form>
  );
}
