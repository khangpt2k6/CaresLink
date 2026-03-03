import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { BookingLinkInfo } from './types';

interface BookingFormProps {
  linkInfo: BookingLinkInfo;
  onSubmit: (data: { guest_name: string; guest_email: string; question_responses: Record<string, string>; reschedule_reason?: string }) => void;
  isSubmitting: boolean;
  error: string | null;
  initialName?: string;
  initialEmail?: string;
  submitLabel?: string;
  isReschedule?: boolean;
}

export function BookingForm({
  linkInfo,
  onSubmit,
  isSubmitting,
  error,
  initialName = '',
  initialEmail = '',
  submitLabel,
  isReschedule,
}: BookingFormProps) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [rescheduleReason, setRescheduleReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const question_responses: Record<string, string> = {};
    for (const q of linkInfo.booking_questions) {
      if (answers[q.id]?.trim()) {
        question_responses[q.label] = answers[q.id];
      }
    }
    onSubmit({ guest_name: name, guest_email: email, question_responses, reschedule_reason: rescheduleReason || undefined });
  };

  const isValid = name.trim() && email.trim() && email.includes('@') &&
    linkInfo.booking_questions
      .filter((q) => q.required)
      .every((q) => answers[q.id]?.trim());

  const inputClass = 'w-full rounded-lg border border-border-strong px-4 py-3 text-sm text-foreground bg-background outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
      {/* Name */}
      <div className="flex flex-col gap-2">
        <label htmlFor="booking-name" className="text-sm font-medium text-foreground">
          {isReschedule ? 'Your name' : 'Name'} {!isReschedule && <span className="text-foreground-muted">*</span>}
        </label>
        <input
          id="booking-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          readOnly={isReschedule}
          className={cn(inputClass, isReschedule && 'bg-surface text-foreground-secondary cursor-default focus:border-border-strong focus:ring-0')}
          placeholder="Your name"
        />
      </div>

      {/* Email */}
      <div className="flex flex-col gap-2">
        <label htmlFor="booking-email" className="text-sm font-medium text-foreground">
          {isReschedule ? 'Email address' : 'Email'} {!isReschedule && <span className="text-foreground-muted">*</span>}
        </label>
        <input
          id="booking-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={isReschedule}
          className={cn(inputClass, isReschedule && 'bg-surface text-foreground-secondary cursor-default focus:border-border-strong focus:ring-0')}
          placeholder="you@example.com"
        />
      </div>

      {/* Dynamic booking questions */}
      {linkInfo.booking_questions.map((q) => (
        <div key={q.id} className="flex flex-col gap-2">
          <label htmlFor={`q-${q.id}`} className="text-sm font-medium text-foreground">
            {q.label}{q.required ? <span className="text-foreground-muted"> *</span> : ''}
          </label>
          {q.type === 'long_text' ? (
            <textarea
              id={`q-${q.id}`}
              required={q.required}
              value={answers[q.id] || ''}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              rows={3}
              className={cn(inputClass, 'resize-none')}
            />
          ) : (
            <input
              id={`q-${q.id}`}
              type="text"
              required={q.required}
              value={answers[q.id] || ''}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              className={inputClass}
            />
          )}
        </div>
      ))}

      {/* Reason for reschedule */}
      {isReschedule && (
        <div className="flex flex-col gap-2">
          <label htmlFor="reschedule-reason" className="text-sm font-medium text-foreground">
            Reason for reschedule
          </label>
          <textarea
            id="reschedule-reason"
            value={rescheduleReason}
            onChange={(e) => setRescheduleReason(e.target.value)}
            rows={3}
            className={cn(inputClass, 'resize-y')}
            placeholder="Let others know why you need to reschedule"
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive bg-destructive-light rounded-lg px-4 py-3">{error}</p>
      )}

      {/* Submit */}
      <div>
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className={cn(
            'w-full rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-foreground-inverse hover:bg-accent-hover',
            'active:scale-[0.98] transition-all',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
          )}
        >
          {isSubmitting ? (isReschedule ? 'Rescheduling...' : 'Scheduling...') : (submitLabel || 'Schedule Meeting')}
        </button>
      </div>
    </form>
  );
}
