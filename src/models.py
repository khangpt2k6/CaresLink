"""Core domain models for the recruitment agent."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class CommunicationChannel(str, Enum):
    """Supported communication channels."""
    EMAIL = "email"
    SMS = "sms"
    PHONE = "phone"


class CandidateStatus(str, Enum):
    """Candidate pipeline status."""
    APPLIED = "applied"
    CONTACTED = "contacted"
    SCHEDULED = "scheduled"
    INTERVIEWED = "interviewed"
    OFFERED = "offered"
    HIRED = "hired"
    REJECTED = "rejected"
    NO_SHOW = "no_show"
    WITHDREW = "withdrew"


class EventType(str, Enum):
    """Analytics event types for data collection."""
    EMAIL_SENT = "email_sent"
    EMAIL_OPENED = "email_opened"
    SMS_SENT = "sms_sent"
    SMS_REPLIED = "sms_replied"
    PHONE_CALL_MADE = "phone_call_made"
    AVAILABILITY_SUBMITTED = "availability_submitted"
    INTERVIEW_SCHEDULED = "interview_scheduled"
    REMINDER_SENT = "reminder_sent"
    INTERVIEW_COMPLETED = "interview_completed"
    INTERVIEW_NO_SHOW = "interview_no_show"
    STATUS_CHANGED = "status_changed"


class Candidate(BaseModel):
    """Candidate in the recruitment pipeline."""
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    position: str
    status: CandidateStatus = CandidateStatus.APPLIED
    applied_at: datetime = Field(default_factory=datetime.now)
    interview_scheduled_at: Optional[datetime] = None
    hired_at: Optional[datetime] = None

    class Config:
        use_enum_values = True


class TimeSlot(BaseModel):
    """A single time slot for scheduling."""
    start: datetime
    end: datetime
    available: bool = True


class AvailabilityWindow(BaseModel):
    """Candidate's availability for interviews."""
    candidate_id: str
    slots: list[TimeSlot]


class Interview(BaseModel):
    """Scheduled interview."""
    id: str
    candidate_id: str
    position: str
    scheduled_at: datetime
    duration_minutes: int = 60
    location: str = "Video Call"
    reminder_sent: bool = False
    completed: bool = False
    no_show: bool = False
