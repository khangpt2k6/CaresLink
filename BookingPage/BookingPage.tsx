import { useState, useMemo, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { SpinnerIcon } from '@/components/icons/SpinnerIcon';
import { apiClient } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBookingLinkInfo, useBookingAvailability, useBookSlot, useCancelBooking, useCancelBookingAsHost, useRescheduleBooking, useBookingDetails, bookingPublicKeys } from './usePublicBooking';
import { HostSidebar } from './HostSidebar';
import { DateTimePicker } from './DateTimePicker';
import { TimeSlotPanel } from './TimeSlotPanel';
import { BookingForm } from './BookingForm';
import { BookingConfirmation } from './BookingConfirmation';
import type { AvailabilitySlot, AvailabilityResponse, BookingStep, BookingConfirmationResponse } from './types';

/** Get yyyy-MM-dd for a Date */
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMonthRange(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toDateString(start), end: toDateString(end) };
}

export function BookingPage() {
  const { hostEmail = '', linkSlug = '', '*': wildcard = '' } = useParams<{
    hostEmail: string;
    linkSlug: string;
    '*'?: string;
  }>();
  const location = useLocation();

  // Extract bookingId from wildcard segment: "cancel/abc123" or "reschedule/abc123" → "abc123"
  const bookingId = wildcard ? (wildcard.split('/').filter(Boolean).pop() ?? '') : '';

  // Determine initial action from URL (cancel/reschedule links from email)
  const urlAction = location.pathname.includes('/cancel/') ? 'cancel' as const
    : location.pathname.includes('/reschedule/') ? 'reschedule' as const
    : null;

  // Step state
  const [step, setStep] = useState<BookingStep>(() =>
    urlAction === 'cancel' ? 'cancelled' : 'select',
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmationResponse | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  // Cancel/reschedule state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string>(bookingId);
  const [rescheduleGuestEmail, setRescheduleGuestEmail] = useState('');
  const [formerStartTime, setFormerStartTime] = useState<string | null>(null);

  // Current month for availability fetching
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const { start: monthStart, end: monthEnd } = useMemo(() => getMonthRange(viewMonth), [viewMonth]);

  // Data fetching
  const {
    data: linkInfo,
    isPending: linkPending,
    error: linkError,
  } = useBookingLinkInfo(hostEmail, linkSlug);

  const {
    data: availabilityData,
    isLoading: availLoading,
    error: availError,
    refetch: refetchAvailability,
  } = useBookingAvailability(
    hostEmail,
    linkSlug,
    monthStart,
    monthEnd,
    timezone,
    !!linkInfo,
  );

  // Detect if the logged-in user is the organizer (host) so we can use the
  // authenticated cancel endpoint which correctly emails the GUEST.
  const { user } = useAuth();
  const isOrganizer = !!user?.email && user.email.toLowerCase() === hostEmail.toLowerCase();

  const bookMutation = useBookSlot(hostEmail, linkSlug);
  const cancelMutation = useCancelBooking(hostEmail, linkSlug);
  const cancelAsHostMutation = useCancelBookingAsHost();
  const rescheduleMutation = useRescheduleBooking(hostEmail, linkSlug);

  // Fetch existing booking details when arriving via cancel/reschedule URL
  const { data: existingBooking, isLoading: bookingLoading } = useBookingDetails(
    hostEmail,
    linkSlug,
    bookingId,
  );

  // Prefetch adjacent months so navigation is instant
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!linkInfo) return;
    const prefetchMonth = (monthDate: Date) => {
      const { start, end } = getMonthRange(monthDate);
      queryClient.prefetchQuery({
        queryKey: bookingPublicKeys.availability(hostEmail, linkSlug, start, end, timezone),
        queryFn: () =>
          apiClient.get<AvailabilityResponse>(
            `/booking/public/${encodeURIComponent(hostEmail)}/${encodeURIComponent(linkSlug)}/availability`,
            { start_date: start, end_date: end, timezone },
            undefined,
            undefined,
            true,
          ),
        staleTime: 60_000,
      });
    };
    const nextMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
    const prevMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
    prefetchMonth(nextMonth);
    prefetchMonth(prevMonth);
  }, [viewMonth, hostEmail, linkSlug, timezone, linkInfo, queryClient]);

  // Auto-select the first available date when slots load
  useEffect(() => {
    if (selectedDate || !availabilityData?.slots?.length) return;
    const firstSlot = availabilityData.slots[0];
    if (firstSlot) {
      setSelectedDate(new Date(firstSlot.start_time));
    }
  }, [availabilityData, selectedDate]);

  // Sync viewMonth when DateTimePicker navigates months
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    // If the selected date is in a different month, update viewMonth
    if (
      date.getMonth() !== viewMonth.getMonth() ||
      date.getFullYear() !== viewMonth.getFullYear()
    ) {
      setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const handleTimezoneChange = (tz: string) => {
    setTimezone(tz);
    // Reset selection since slots will change
    setSelectedDate(null);
    setSelectedSlot(null);
  };

  const handleSlotSelect = (slot: AvailabilitySlot) => {
    setSelectedSlot(slot);
    setBookingError(null);
    setStep('form');
  };

  const handleBookingSubmit = (data: {
    guest_name: string;
    guest_email: string;
    question_responses: Record<string, string>;
  }) => {
    if (!selectedSlot) return;
    setBookingError(null);

    // If rescheduling, call reschedule mutation instead
    if (rescheduleBookingId) {
      // Optimistic: transition to confirmed immediately
      const optimisticReschedule: BookingConfirmationResponse = {
        booking: {
          id: rescheduleBookingId,
          booking_link_id: linkSlug,
          guest_name: data.guest_name,
          guest_email: data.guest_email,
          guest_timezone: timezone,
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
          status: 'confirmed',
          created_at: new Date().toISOString(),
        },
              // conferencing_url comes from server response only (linkInfo.conferencing is a type, not a URL)
      };
      setConfirmation(optimisticReschedule);
      setRescheduleBookingId('');
      setStep('confirmed');

      rescheduleMutation.mutate(
        {
          booking_id: rescheduleBookingId,
          guest_email: data.guest_email,
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
          guest_timezone: timezone,
        },
        {
          onSuccess: (result) => {
            setConfirmation(result);
          },
          onError: (error: any) => {
            setConfirmation(null);
            setBookingError(error?.detail || 'Failed to reschedule. Please try again.');
            setStep('form');
          },
        },
      );
      return;
    }

    // Optimistic: transition to confirmed immediately
    const optimisticConfirmation: BookingConfirmationResponse = {
      booking: {
        id: `optimistic-${Date.now()}`,
        booking_link_id: linkSlug,
        guest_name: data.guest_name,
        guest_email: data.guest_email,
        guest_timezone: timezone,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        status: 'confirmed',
        created_at: new Date().toISOString(),
      },
            // conferencing_url comes from server response only (linkInfo.conferencing is a type, not a URL)
    };
    setConfirmation(optimisticConfirmation);
    setStep('confirmed');

    bookMutation.mutate(
      {
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        guest_name: data.guest_name,
        guest_email: data.guest_email,
        guest_timezone: timezone,
        question_responses: data.question_responses,
      },
      {
        onSuccess: (result) => {
          // Replace optimistic data with real server response
          setConfirmation(result);
        },
        onError: (error: any) => {
          // Revert optimistic update
          setConfirmation(null);
          if (error?.status === 409) {
            const detail = error?.detail || '';
            if (detail.toLowerCase().includes('duplicate') || detail.toLowerCase().includes('already')) {
              setBookingError('You already have an active booking for this link.');
              setStep('form');
            } else {
              setBookingError('This time slot is no longer available. Please select another time.');
              setStep('select');
              setSelectedSlot(null);
              refetchAvailability();
            }
          } else {
            setBookingError(error?.detail || 'Something went wrong. Please try again.');
            setStep('form');
          }
        },
      },
    );
  };

  const handleCancel = () => {
    setShowCancelConfirm(true);
  };

  const handleConfirmCancel = () => {
    if (!confirmation && !existingBooking) return;
    const bid = confirmation?.booking.id || existingBooking?.id || bookingId;
    const email = confirmation?.booking.guest_email || existingBooking?.guest_email || '';
    if (!bid || !email) return;

    // Optimistic: transition to cancelled immediately
    const reasonSnapshot = cancelReason;
    setShowCancelConfirm(false);
    setStep('cancelled');

    const onError = (error: any) => {
      setCancelReason('');
      setStep('confirmed');
      const status = error?.status;
      if (status === 404) {
        setBookingError('Booking not found. It may have already been cancelled.');
      } else {
        setBookingError(error?.detail || 'Failed to cancel booking. Please try again.');
      }
    };

    if (isOrganizer) {
      // Host-initiated cancel: authenticated endpoint → emails the GUEST
      cancelAsHostMutation.mutate(
        { bookingId: bid, reason: reasonSnapshot || undefined },
        { onError },
      );
    } else {
      // Guest-initiated cancel: public endpoint → emails the HOST
      cancelMutation.mutate(
        { booking_id: bid, guest_email: email, reason: reasonSnapshot || undefined },
        { onError },
      );
    }
  };

  const handleReschedule = () => {
    const bid = confirmation?.booking.id || existingBooking?.id || bookingId;
    const email = confirmation?.booking.guest_email || existingBooking?.guest_email || '';
    if (bid) setRescheduleBookingId(bid);
    if (email) setRescheduleGuestEmail(email);
    setFormerStartTime(confirmation?.booking.start_time || existingBooking?.start_time || null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setBookingError(null);
    setStep('select');
  };

  // Slashy branding header
  const slashyHeader = (
    <div className="flex items-center justify-center px-4 pt-3 pb-0 desktop:px-6 desktop:pt-6 desktop:pb-1">
      <a href="/" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
        <img src="/DashTrans.svg" alt="Slashy" className="h-6 w-6 desktop:h-8 desktop:w-8" />
        <span className="font-semibold text-foreground text-base desktop:text-xl">Slashy</span>
      </a>
    </div>
  );

  // Loading state
  if (linkPending || (bookingId && bookingLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface dark:bg-background">
        <SpinnerIcon className="h-6 w-6 text-foreground-muted" />
      </div>
    );
  }

  // Error / 404 state
  if (linkError || !linkInfo) {
    return (
      <div className="flex min-h-screen flex-col bg-surface dark:bg-background">
        {slashyHeader}
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="w-full max-w-md rounded-xl bg-background dark:bg-surface p-8 shadow-sm border border-border text-center">
            <h1 className="text-lg font-semibold text-foreground">Booking link not found</h1>
            <p className="mt-2 text-sm text-foreground-secondary">
              This booking link doesn't exist or has expired.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Cancel confirmation dialog (inline)
  if (step === 'cancelled' && !urlAction) {
    const cb = confirmation?.booking;
    const cancelledTitle = linkInfo ? (linkInfo.title !== 'Meeting' ? linkInfo.title : `${linkInfo.duration_minutes}-Minute Meeting`) : 'Meeting';
    return (
      <div className="h-screen flex flex-col bg-surface dark:bg-background overflow-y-auto">
        {slashyHeader}
        <div className="flex justify-center px-2 py-6 desktop:px-4 desktop:py-10">
          <div className="w-full max-w-md rounded-xl bg-background dark:bg-surface shadow-sm border border-border overflow-hidden">
            <div className="flex flex-col items-center text-center gap-4 px-6 pt-6 pb-4 desktop:px-8 desktop:pt-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FEE2E2] dark:bg-[rgba(239,68,68,0.2)]">
                <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground">This event is cancelled</h2>
            </div>

            {/* Detail rows */}
            <div className="border-t border-border px-6 desktop:px-8 pt-1 pb-2 text-[13px]">
              {cancelReason && (
                <div className="flex gap-6 py-2.5">
                  <span className="w-28 shrink-0 text-foreground-secondary">Reason</span>
                  <span className="text-foreground">{cancelReason}</span>
                </div>
              )}
              {cb?.guest_email && (
                <div className="flex gap-6 py-2.5">
                  <span className="w-28 shrink-0 text-foreground-secondary">Cancelled by</span>
                  <span className="text-foreground">{cb.guest_email}</span>
                </div>
              )}
              <div className="flex gap-6 py-2.5">
                <span className="w-28 shrink-0 text-foreground-secondary">What</span>
                <span className="text-foreground">{cancelledTitle}</span>
              </div>
              {cb && (
                <div className="flex gap-6 py-2.5">
                  <span className="w-28 shrink-0 text-foreground-secondary">When</span>
                  <div>
                    <span className="line-through text-foreground-secondary">
                      {new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(cb.start_time))}
                    </span>
                    <br />
                    <span className="line-through text-foreground-secondary">
                      {new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(cb.start_time))}
                      {' - '}
                      {new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(cb.end_time))}
                      {' ('}
                      {timezone}
                      {')'}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex gap-6 py-2.5">
                <span className="w-28 shrink-0 text-foreground-secondary">Who</span>
                <div className="flex flex-col gap-2">
                  {linkInfo?.host_name && (
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">{linkInfo.host_name}</span>
                        <span className="text-[11px] bg-surface border border-border rounded px-1 py-0.5 text-foreground-secondary">Host</span>
                      </div>
                      <span className="text-foreground-secondary text-[12px]">{hostEmail}</span>
                    </div>
                  )}
                  {cb && (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-foreground">{cb.guest_name}</span>
                      <span className="text-foreground-secondary text-[12px]">{cb.guest_email}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Book again + footer */}
            <div className="border-t border-border px-6 desktop:px-8 py-4 flex items-center justify-center">
              <a
                href={`/book/${encodeURIComponent(hostEmail)}/${encodeURIComponent(linkSlug)}`}
                className="text-[13px] font-medium text-accent hover:underline underline-offset-2 transition-colors"
              >
                Book a new time
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // URL-based cancel flow (from email link)
  if (urlAction === 'cancel' && bookingId) {
    return (
      <div className="flex min-h-screen flex-col bg-surface dark:bg-background">
        {slashyHeader}
        <div className="flex flex-1 items-start desktop:items-center justify-center px-2 py-2 desktop:px-4 desktop:py-8">
          <div className="w-full max-w-md rounded-xl bg-background dark:bg-surface shadow-sm border border-border overflow-hidden">
            {step === 'cancelled' ? (() => {
              const eb = existingBooking;
              const urlCancelledTitle = linkInfo ? (linkInfo.title !== 'Meeting' ? linkInfo.title : `${linkInfo.duration_minutes}-Minute Meeting`) : 'Meeting';
              return (
                <>
                  <div className="flex flex-col items-center text-center gap-4 px-6 pt-6 pb-4 desktop:px-8 desktop:pt-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FEE2E2] dark:bg-[rgba(239,68,68,0.2)]">
                      <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">This event is cancelled</h2>
                  </div>

                  <div className="border-t border-border px-6 desktop:px-8 pt-1 pb-2 text-[13px]">
                    {cancelReason && (
                      <div className="flex gap-6 py-2.5">
                        <span className="w-28 shrink-0 text-foreground-secondary">Reason</span>
                        <span className="text-foreground">{cancelReason}</span>
                      </div>
                    )}
                    {eb?.guest_email && (
                      <div className="flex gap-6 py-2.5">
                        <span className="w-28 shrink-0 text-foreground-secondary">Cancelled by</span>
                        <span className="text-foreground">{eb.guest_email}</span>
                      </div>
                    )}
                    <div className="flex gap-6 py-2.5">
                      <span className="w-28 shrink-0 text-foreground-secondary">What</span>
                      <span className="text-foreground">{urlCancelledTitle}</span>
                    </div>
                    {eb && (
                      <div className="flex gap-6 py-2.5">
                        <span className="w-28 shrink-0 text-foreground-secondary">When</span>
                        <div>
                          <span className="line-through text-foreground-secondary">
                            {new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(eb.start_time))}
                          </span>
                          <br />
                          <span className="line-through text-foreground-secondary">
                            {new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(eb.start_time))}
                            {' - '}
                            {new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(eb.end_time))}
                            {' ('}{timezone}{')'}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-6 py-2.5">
                      <span className="w-28 shrink-0 text-foreground-secondary">Who</span>
                      <div className="flex flex-col gap-2">
                        {linkInfo?.host_name && (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground">{linkInfo.host_name}</span>
                              <span className="text-[11px] bg-surface border border-border rounded px-1 py-0.5 text-foreground-secondary">Host</span>
                            </div>
                            <span className="text-foreground-secondary text-[12px]">{hostEmail}</span>
                          </div>
                        )}
                        {eb && (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground">{eb.guest_name}</span>
                            <span className="text-foreground-secondary text-[12px]">{eb.guest_email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border px-6 desktop:px-8 py-4 flex items-center justify-center">
                    <a
                      href={`/book/${encodeURIComponent(hostEmail)}/${encodeURIComponent(linkSlug)}`}
                      className="text-[13px] font-medium text-accent hover:underline underline-offset-2 transition-colors"
                    >
                      Book a new time
                    </a>
                  </div>
                </>
              );
            })() : (
              <>
                {/* Event details */}
                <div className="p-6 desktop:p-8 flex flex-col gap-1">
                  <h2 className="text-base font-semibold text-foreground mb-3">Cancel this booking</h2>
                  {existingBooking && (() => {
                    const startDt = new Date(existingBooking.start_time);
                    const endDt = new Date(existingBooking.end_time);
                    const fmtDate = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(startDt);
                    const fmtTime = (d: Date) => new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
                    const conferencingUrl = existingBooking.conferencing_url;
                    return (
                      <div className="border-t border-border text-[13px]">
                        {linkInfo?.title && (
                          <div className="flex gap-6 py-2.5 border-b border-border">
                            <span className="w-28 shrink-0 text-foreground-secondary">What</span>
                            <span className="text-foreground">{linkInfo.title}</span>
                          </div>
                        )}
                        <div className="flex gap-6 py-2.5 border-b border-border">
                          <span className="w-28 shrink-0 text-foreground-secondary">When</span>
                          <div className="text-foreground">
                            <div>{fmtDate}</div>
                            <div className="text-foreground-secondary">{fmtTime(startDt)} - {fmtTime(endDt)} ({timezone})</div>
                          </div>
                        </div>
                        <div className="flex gap-6 py-2.5 border-b border-border">
                          <span className="w-28 shrink-0 text-foreground-secondary">Who</span>
                          <div className="flex flex-col gap-1.5">
                            {linkInfo?.host_name && (
                              <div>
                                <span className="text-foreground font-medium">{linkInfo.host_name}</span>
                                <span className="ml-1.5 text-[11px] bg-surface border border-border rounded px-1 py-0.5 text-foreground-secondary">Host</span>
                                <div className="text-foreground-secondary text-[12px]">{hostEmail}</div>
                              </div>
                            )}
                            <div>
                              <div className="text-foreground font-medium">{existingBooking.guest_name}</div>
                              <div className="text-foreground-secondary text-[12px]">{existingBooking.guest_email}</div>
                            </div>
                          </div>
                        </div>
                        {conferencingUrl && (
                          <div className="flex gap-6 py-2.5">
                            <span className="w-28 shrink-0 text-foreground-secondary">Where</span>
                            <a href={conferencingUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline underline-offset-2 inline-flex items-center gap-1">
                              {conferencingUrl.includes('meet.google') ? 'Google Meet' : conferencingUrl.includes('zoom.us') ? 'Zoom' : 'Video call'}
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Cancellation reason + actions */}
                <div className="border-t border-border p-6 desktop:p-8 flex flex-col gap-3">
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason for cancellation (optional)"
                    rows={3}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground bg-background placeholder:text-foreground-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none resize-none"
                  />
                  {bookingError && (
                    <p className="text-sm text-destructive">{bookingError}</p>
                  )}
                  <div className="flex gap-2 justify-end">
                    <a
                      href={`/book/${encodeURIComponent(hostEmail)}/${encodeURIComponent(linkSlug)}`}
                      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-hover transition-colors"
                    >
                      Nevermind
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        const email = existingBooking?.guest_email || '';
                        if (!email) return;
                        cancelMutation.mutate(
                          { booking_id: bookingId, guest_email: email, reason: cancelReason || undefined },
                          {
                            onSuccess: () => setStep('cancelled'),
                            onError: (error: any) => setBookingError(error?.detail || 'Failed to cancel.'),
                          },
                        );
                      }}
                      disabled={cancelMutation.isPending}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-foreground-inverse hover:bg-accent-hover transition-colors disabled:opacity-50"
                    >
                      {cancelMutation.isPending ? 'Cancelling...' : 'Cancel event'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Confirmation step
  if (step === 'confirmed' && confirmation) {
    return (
      <div className="h-screen flex flex-col bg-surface dark:bg-background overflow-y-auto">
        {slashyHeader}
        <div className="flex justify-center px-2 py-6 desktop:px-4 desktop:py-10">
          <div className="w-full max-w-md rounded-xl bg-background dark:bg-surface shadow-sm border border-border overflow-hidden">
            <BookingConfirmation
              confirmation={confirmation}
              timezone={timezone}
              linkTitle={linkInfo ? (linkInfo.title && linkInfo.title !== 'Meeting' ? linkInfo.title : `${linkInfo.duration_minutes}-Minute Meeting`) : undefined}
              hostName={linkInfo?.host_name}
              hostEmail={hostEmail}
              onReschedule={handleReschedule}
              onCancel={handleCancel}
              isPending={bookMutation.isPending || rescheduleMutation.isPending}
            />

            {/* Inline cancel confirmation — cal.com inspired, Notion styled */}
            {showCancelConfirm && (
              <div className="border-t border-border px-6 desktop:px-8 py-5">
                <p className="text-[13px] font-semibold text-foreground mb-3">Reason for cancellation</p>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Why are you cancelling?"
                  rows={3}
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-[13px] text-foreground bg-surface placeholder:text-foreground-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none resize-y mb-2"
                />
                {bookingError && (
                  <p className="text-[13px] text-destructive mb-3">{bookingError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowCancelConfirm(false); setCancelReason(''); setBookingError(null); }}
                    className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-foreground hover:bg-hover transition-colors"
                  >
                    Nevermind
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCancel}
                    disabled={cancelMutation.isPending}
                    className="rounded-lg bg-accent text-foreground-inverse px-4 py-2 text-[13px] font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                  >
                    {cancelMutation.isPending ? 'Cancelling...' : 'Cancel event'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Form step
  if (step === 'form' && selectedSlot) {
    return (
      <div className="flex min-h-screen flex-col bg-surface dark:bg-background">
        {slashyHeader}
        <div className="flex flex-1 items-start desktop:items-center justify-center px-2 py-2 desktop:px-4 desktop:py-8">
          <div className="w-full max-w-3xl desktop:h-[520px] rounded-xl bg-background dark:bg-surface p-3 desktop:p-8 shadow-sm border border-border flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col gap-3 desktop:gap-6 desktop:grid desktop:grid-cols-[240px_1fr] min-h-0">
              <HostSidebar
                linkInfo={linkInfo}
                onBack={() => {
                  setStep('select');
                  setBookingError(null);
                }}
                selectedSlot={selectedSlot}
                timezone={timezone}
                formerTime={formerStartTime ? { start_time: formerStartTime, timezone } : undefined}
              />
              <BookingForm
                linkInfo={linkInfo}
                onSubmit={handleBookingSubmit}
                isSubmitting={bookMutation.isPending || rescheduleMutation.isPending}
                error={bookingError}
                initialName={rescheduleBookingId ? (confirmation?.booking.guest_name || existingBooking?.guest_name || '') : ''}
                initialEmail={rescheduleBookingId ? (rescheduleGuestEmail || confirmation?.booking.guest_email || existingBooking?.guest_email || '') : ''}
                submitLabel={rescheduleBookingId ? 'Reschedule' : undefined}
                isReschedule={!!rescheduleBookingId}
              />
            </div>

            {/* Footer — negative margins to make divider edge-to-edge */}
            <div className="-mx-3 desktop:-mx-8 mt-3 desktop:mt-6 border-t border-border">
              <div className="px-3 desktop:px-8 pt-2 desktop:pt-4 text-center">
                <span className="text-xs text-foreground-muted">
                  Scheduled with{' '}
                  <a href="https://slashy.com" className="text-accent font-medium hover:underline">Slashy</a>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Selection step (date + time)
  const slots = availabilityData?.slots ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-surface dark:bg-background">
      {slashyHeader}
      <div className="flex flex-1 items-start desktop:items-center justify-center px-2 py-2 desktop:px-4 desktop:py-8">
        <div className="w-full max-w-3xl desktop:h-[520px] rounded-xl bg-background dark:bg-surface p-3 desktop:p-8 shadow-sm border border-border flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col gap-3 desktop:gap-6 desktop:grid desktop:grid-cols-[180px_1fr_180px] min-h-0">
            {/* Left: host info */}
            <HostSidebar
              linkInfo={linkInfo}
              formerTime={formerStartTime ? { start_time: formerStartTime, timezone } : undefined}
            />

            {/* Center: calendar */}
            <div className="relative">
              <DateTimePicker
                slots={slots}
                timezone={timezone}
                onTimezoneChange={handleTimezoneChange}
                selectedDate={selectedDate}
                onSelectDate={handleDateSelect}
                onMonthChange={(month) => setViewMonth(month)}
              />

              {/* Availability loading overlay */}
              {availLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 dark:bg-surface/60 rounded-lg">
                  <SpinnerIcon className="h-5 w-5 text-foreground-muted" />
                </div>
              )}

              {/* Availability error */}
              {availError && !availLoading && (
                <div className="mt-3 rounded-lg bg-destructive-light px-3 py-2 text-sm text-destructive">
                  Failed to load availability.{' '}
                  <button
                    type="button"
                    onClick={() => refetchAvailability()}
                    className="underline hover:no-underline"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            {/* Right: time slots — always rendered to keep layout stable */}
            <div className="hidden desktop:flex desktop:flex-col desktop:min-h-0 desktop:overflow-hidden">
              {selectedDate ? (
                <TimeSlotPanel
                  selectedDate={selectedDate}
                  slots={slots}
                  timezone={timezone}
                  onSelect={handleSlotSelect}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-foreground-muted">Select a date</p>
                </div>
              )}
            </div>

            {/* Mobile: only show time slots when date selected */}
            {selectedDate && (
              <div className="desktop:hidden">
                <TimeSlotPanel
                  selectedDate={selectedDate}
                  slots={slots}
                  timezone={timezone}
                  onSelect={handleSlotSelect}
                />
              </div>
            )}
          </div>

          {/* Footer — negative margins to make divider edge-to-edge */}
          <div className="-mx-3 desktop:-mx-8 mt-3 desktop:mt-6 border-t border-border">
            <div className="px-3 desktop:px-8 pt-2 desktop:pt-4 text-center">
              <span className="text-xs text-foreground-muted">
                Scheduled with{' '}
                <a href="https://slashy.com" className="text-accent font-medium hover:underline">Slashy</a>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
