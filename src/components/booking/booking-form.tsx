"use client";

import { useState } from "react";
import { format } from "date-fns";
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
  "w-full rounded-md border border-[#e8e8e5] bg-white px-3 py-2.5 text-sm text-[#37352f] placeholder:text-[#b4b4b0] focus:border-[#2383e2] focus:outline-none focus:ring-1 focus:ring-[#2383e2]/20";

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
      <div className="flex items-center gap-4 rounded-md bg-[#f7f7f5] px-4 py-3 text-sm text-[#37352f]">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-[#9b9a97]" />
          {format(d, "EEEE, MMMM d, yyyy")}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-[#9b9a97]" />
          {format(d, "h:mm a")} EST
        </span>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-1.5 text-xs font-medium text-[#73726e]">
          <User className="h-3.5 w-3.5" /> Name <span className="text-[#9b9a97]">*</span>
        </label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={inputClass}
          placeholder="Your full name"
        />
      </div>

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-1.5 text-xs font-medium text-[#73726e]">
          <Mail className="h-3.5 w-3.5" /> Email <span className="text-[#9b9a97]">*</span>
        </label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className={inputClass}
          placeholder="you@example.com"
        />
      </div>

      {/* Phone */}
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-1.5 text-xs font-medium text-[#73726e]">
          <Phone className="h-3.5 w-3.5" /> Phone
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className={inputClass}
          placeholder="+1 (555) 000-0000"
        />
      </div>

      {/* Position */}
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-1.5 text-xs font-medium text-[#73726e]">
          <Briefcase className="h-3.5 w-3.5" /> Position <span className="text-[#9b9a97]">*</span>
        </label>
        <input
          type="text"
          required
          value={form.position}
          onChange={(e) => setForm({ ...form, position: e.target.value })}
          className={inputClass}
          placeholder="e.g. Software Engineer"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-md bg-[#ffe2dd] px-3 py-2 text-sm text-[#93392e]">
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!isValid || submitting}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-[#2383e2] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1b6ec2] transition-colors disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Scheduling...
          </>
        ) : (
          "Confirm Interview"
        )}
      </button>
    </form>
  );
}
