"""Communication channels: email, SMS, phone (with analytics integration)."""

from datetime import datetime
from typing import Optional

from .analytics.data_collector import DataCollector
from .models import Candidate, CommunicationChannel, EventType


class CommunicationService:
    """Handles outreach with analytics tracking."""

    def __init__(self, analytics: DataCollector):
        self.analytics = analytics

    def send_email(
        self,
        candidate: Candidate,
        subject: str,
        body: str,
        campaign_id: Optional[str] = None,
    ) -> bool:
        """Send email to candidate (mock; integrate SendGrid/ etc. in production)."""
        # In production: sendgrid.send(...)
        self.analytics.log_event(
            event_type=EventType.EMAIL_SENT.value,
            candidate_id=candidate.id,
            position=candidate.position,
            channel=CommunicationChannel.EMAIL.value,
            metadata={"subject": subject, "sent_at": datetime.utcnow().isoformat()},
            campaign_id=campaign_id,
            cost=0.02,  # Approx cost per email
        )
        return True

    def send_sms(
        self,
        candidate: Candidate,
        message: str,
        campaign_id: Optional[str] = None,
    ) -> bool:
        """Send SMS to candidate (mock; integrate Twilio in production)."""
        if not candidate.phone:
            return False
        # In production: twilio.messages.create(...)
        self.analytics.log_event(
            event_type=EventType.SMS_SENT.value,
            candidate_id=candidate.id,
            position=candidate.position,
            channel=CommunicationChannel.SMS.value,
            metadata={"message_preview": message[:50], "sent_at": datetime.utcnow().isoformat()},
            campaign_id=campaign_id,
            cost=0.05,  # Approx cost per SMS
        )
        return True

    def record_response(
        self,
        candidate_id: str,
        channel: CommunicationChannel,
        position: Optional[str] = None,
    ) -> None:
        """Record that candidate responded (e.g. opened email, replied to SMS)."""
        event = EventType.EMAIL_OPENED.value if channel == CommunicationChannel.EMAIL else EventType.SMS_REPLIED.value
        self.analytics.log_event(
            event_type=event,
            candidate_id=candidate_id,
            position=position,
            channel=channel.value,
        )
