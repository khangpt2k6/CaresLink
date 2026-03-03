export interface BookingQuestion {
  id: string;
  label: string;
  type: 'short_text' | 'long_text';
  required: boolean;
}

export interface BookingLinkInfo {
  title: string;
  description?: string;
  duration_minutes: number;
  host_name?: string;
  booking_questions: BookingQuestion[];
  conferencing?: string;
  location?: string;
}

export interface AvailabilitySlot {
  start_time: string; // ISO 8601
  end_time: string;   // ISO 8601
}

export interface AvailabilityResponse {
  slots: AvailabilitySlot[];
  timezone: string;
}

export interface BookingRequest {
  start_time: string; // ISO 8601
  end_time: string;   // ISO 8601
  guest_name: string;
  guest_email: string;
  guest_timezone: string;
  question_responses?: Record<string, string>;
}

export interface BookingResponse {
  id: string;
  booking_link_id: string;
  guest_name: string;
  guest_email: string;
  guest_timezone: string;
  start_time: string;
  end_time: string;
  status: string;
  conferencing_url?: string;
  created_at: string;
}

export interface BookingConfirmationResponse {
  booking: BookingResponse;
  calendar_event_id?: string;
  conferencing_url?: string;
  cancel_url?: string;
  reschedule_url?: string;
  /** Server-generated ICS download URL. When present, used directly instead of client-side generation. */
  ics_url?: string;
}

export interface CancelBookingRequest {
  booking_id: string;
  guest_email: string;
  reason?: string;
}

export interface RescheduleBookingRequest {
  booking_id: string;
  guest_email: string;
  start_time: string;
  end_time: string;
  guest_timezone: string;
}

export type BookingStep = 'select' | 'form' | 'confirmed' | 'cancelled';
