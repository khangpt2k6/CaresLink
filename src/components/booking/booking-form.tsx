"use client";

import { useState } from "react";
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
}

const inputClass =
  "w-full rounded-lg border border-[#e2e8f0] bg-white px-3.5 py-2.5 text-sm text-[#1a2b3c] placeholder:text-[#8a95a3] transition-all duration-200 focus:border-[#0090d9] focus:outline-none focus:ring-2 focus:ring-[#0090d9]/20";

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
}: BookingFormProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    position: "",
  });

  const d = new Date(selectedSlot);
  const isValid =
    form.name.trim() && form.email.trim() && form.email.includes("@") && form.position.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Selected time summary */}
      <motion.div
        custom={0}
        variants={fieldVariants}
        initial="hidden"
        animate="visible"
        className="flex items-center gap-4 rounded-xl border border-[#e2e8f0] bg-[#e8f4fd]/50 px-4 py-3.5 text-sm text-[#1a2b3c]"
      >
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#0090d9]" />
          {format(d, "EEEE, MMMM d, yyyy")}
        </span>
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#0090d9]" />
          {format(d, "h:mm a")} EST
        </span>
      </motion.div>

      {[
        { key: "name", icon: User, label: "Name", required: true, placeholder: "Your full name", type: "text" as const, value: form.name, set: (v: string) => setForm((f) => ({ ...f, name: v })), index: 1 },
        { key: "email", icon: Mail, label: "Email", required: true, placeholder: "you@example.com", type: "email" as const, value: form.email, set: (v: string) => setForm((f) => ({ ...f, email: v })), index: 2 },
        { key: "phone", icon: Phone, label: "Phone", required: false, placeholder: "+1 (555) 000-0000", type: "tel" as const, value: form.phone, set: (v: string) => setForm((f) => ({ ...f, phone: v })), index: 3 },
        { key: "position", icon: Briefcase, label: "Position", required: true, placeholder: "e.g. Software Engineer", type: "text" as const, value: form.position, set: (v: string) => setForm((f) => ({ ...f, position: v })), index: 4 },
      ].map(({ key, icon: Icon, label, required, placeholder, type, value, set, index }) => (
        <motion.div
          key={key}
          custom={index}
          variants={fieldVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-1.5"
        >
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#5a6b7c]">
            <Icon className="h-3.5 w-3.5 text-[#0090d9]" /> {label}
            {required && <span className="text-[#ef4444]">*</span>}
          </label>
          <input
            type={type}
            required={required}
            value={value}
            onChange={(e) => set(e.target.value)}
            className={inputClass}
            placeholder={placeholder}
          />
        </motion.div>
      ))}

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
          "Confirm Interview"
        )}
      </motion.button>
    </form>
  );
}
