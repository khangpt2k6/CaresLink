"""Interview scheduling with availability checking and reminders."""

import uuid
from datetime import datetime, timedelta
from typing import Optional

from .analytics.data_collector import DataCollector
from .communications import CommunicationService
from .models import Candidate, Interview, TimeSlot, EventType


class SchedulingService:
    """Handles availability and interview scheduling."""

    def __init__(
        self,
        analytics: DataCollector,
        communications: Optional[CommunicationService] = None,
    ):
        self.analytics = analytics
        self.communications = communications

    def find_next_available_slot(
        self,
        candidate_slots: list[TimeSlot],
        duration_minutes: int = 60,
    ) -> Optional[datetime]:
        """Pick the first available slot from candidate's availability."""
        now = datetime.utcnow()
        for slot in sorted(candidate_slots, key=lambda s: s.start):
            if slot.available and slot.start >= now and slot.end >= slot.start + timedelta(minutes=duration_minutes):
                return slot.start
        return None

    def schedule_interview(
        self,
        candidate: Candidate,
        slot: datetime,
        duration_minutes: int = 60,
        location: str = "Video Call",
    ) -> Interview:
        """Schedule an interview and log analytics event."""
        interview = Interview(
            id=str(uuid.uuid4()),
            candidate_id=candidate.id,
            position=candidate.position,
            scheduled_at=slot,
            duration_minutes=duration_minutes,
            location=location,
        )
        self.analytics.log_event(
            event_type=EventType.INTERVIEW_SCHEDULED.value,
            candidate_id=candidate.id,
            position=candidate.position,
            metadata={
                "interview_id": interview.id,
                "scheduled_at": slot.isoformat(),
                "duration_minutes": duration_minutes,
            },
        )
        return interview

    def send_reminder(
        self,
        interview: Interview,
        candidate: Candidate,
    ) -> bool:
        """Send reminder before interview (24h and/or 1h)."""
        if not self.communications:
            return False
        msg = f"Reminder: Your interview for {interview.position} is at {interview.scheduled_at.strftime('%A, %B %d at %I:%M %p')}. Reply CONFIRM to confirm."
        sent = self.communications.send_sms(candidate, msg, campaign_id="interview_reminder")
        if sent:
            self.analytics.log_event(
                event_type=EventType.REMINDER_SENT.value,
                candidate_id=candidate.id,
                position=interview.position,
                channel="sms",
                metadata={"interview_id": interview.id},
            )
            interview.reminder_sent = True
        return sent

    def record_no_show(self, interview: Interview) -> None:
        """Record that candidate did not show for interview."""
        self.analytics.log_event(
            event_type=EventType.INTERVIEW_NO_SHOW.value,
            candidate_id=interview.candidate_id,
            position=interview.position,
            metadata={"interview_id": interview.id},
        )
        interview.no_show = True

    def record_completed(self, interview: Interview) -> None:
        """Record that interview was completed."""
        self.analytics.log_event(
            event_type=EventType.INTERVIEW_COMPLETED.value,
            candidate_id=interview.candidate_id,
            position=interview.position,
            metadata={"interview_id": interview.id},
        )
        interview.completed = True
