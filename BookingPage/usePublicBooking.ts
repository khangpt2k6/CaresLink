import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type {
  BookingLinkInfo,
  AvailabilityResponse,
  BookingRequest,
  BookingConfirmationResponse,
  BookingResponse,
  CancelBookingRequest,
  RescheduleBookingRequest,
} from './types';

export const bookingPublicKeys = {
  all: ['booking-public'] as const,
  linkInfo: (hostEmail: string, linkSlug: string) =>
    [...bookingPublicKeys.all, 'link', hostEmail, linkSlug] as const,
  availability: (hostEmail: string, linkSlug: string, startDate: string, endDate: string, timezone: string) =>
    [...bookingPublicKeys.all, 'availability', hostEmail, linkSlug, startDate, endDate, timezone] as const,
};

export function useBookingLinkInfo(hostEmail: string, linkSlug: string) {
  return useQuery<BookingLinkInfo>({
    queryKey: bookingPublicKeys.linkInfo(hostEmail, linkSlug),
    queryFn: ({ signal }) =>
      apiClient.get<BookingLinkInfo>(
        `/booking/public/${encodeURIComponent(hostEmail)}/${encodeURIComponent(linkSlug)}`,
        undefined,
        signal,
        undefined,
        true, // skipAuthWait
      ),
    staleTime: 5 * 60_000,
    retry: (failureCount, error: any) => {
      // Don't retry 404s (link doesn't exist)
      if (error?.status === 404) return false;
      return failureCount < 2;
    },
  });
}

export function useBookingAvailability(
  hostEmail: string,
  linkSlug: string,
  startDate: string,
  endDate: string,
  timezone: string,
  enabled = true,
) {
  return useQuery<AvailabilityResponse>({
    queryKey: bookingPublicKeys.availability(hostEmail, linkSlug, startDate, endDate, timezone),
    queryFn: ({ signal }) =>
      apiClient.get<AvailabilityResponse>(
        `/booking/public/${encodeURIComponent(hostEmail)}/${encodeURIComponent(linkSlug)}/availability`,
        { start_date: startDate, end_date: endDate, timezone },
        signal,
        undefined,
        true, // skipAuthWait
      ),
    staleTime: 60_000,
    enabled,
  });
}

export function useBookSlot(hostEmail: string, linkSlug: string) {
  return useMutation<BookingConfirmationResponse, any, BookingRequest>({
    mutationFn: (data) =>
      apiClient.post<BookingConfirmationResponse>(
        `/booking/public/${encodeURIComponent(hostEmail)}/${encodeURIComponent(linkSlug)}/book`,
        data,
        undefined,
        undefined,
        true, // skipAuthWait
      ),
  });
}

export function useBookingDetails(hostEmail: string, linkSlug: string, bookingId: string) {
  return useQuery<BookingResponse>({
    queryKey: [...bookingPublicKeys.all, 'booking', hostEmail, linkSlug, bookingId],
    queryFn: ({ signal }) =>
      apiClient.get<BookingResponse>(
        `/booking/public/${encodeURIComponent(hostEmail)}/${encodeURIComponent(linkSlug)}/bookings/${encodeURIComponent(bookingId)}`,
        undefined,
        signal,
        undefined,
        true, // skipAuthWait
      ),
    enabled: Boolean(bookingId),
    staleTime: 60_000,
  });
}

export function useCancelBooking(hostEmail: string, linkSlug: string) {
  return useMutation<void, any, CancelBookingRequest>({
    mutationFn: (data) =>
      apiClient.post<void>(
        `/booking/public/${encodeURIComponent(hostEmail)}/${encodeURIComponent(linkSlug)}/cancel`,
        data,
        undefined,
        undefined,
        true, // skipAuthWait
      ),
  });
}

/** Host-authenticated cancel — sends cancellation email to the GUEST. */
export function useCancelBookingAsHost() {
  return useMutation<void, any, { bookingId: string; reason?: string }>({
    mutationFn: ({ bookingId, reason }) =>
      apiClient.post<void>(`/booking/bookings/${encodeURIComponent(bookingId)}/cancel`, { reason }),
  });
}

export function useRescheduleBooking(hostEmail: string, linkSlug: string) {
  return useMutation<BookingConfirmationResponse, any, RescheduleBookingRequest>({
    mutationFn: (data) =>
      apiClient.post<BookingConfirmationResponse>(
        `/booking/public/${encodeURIComponent(hostEmail)}/${encodeURIComponent(linkSlug)}/reschedule`,
        data,
        undefined,
        undefined,
        true, // skipAuthWait
      ),
  });
}
