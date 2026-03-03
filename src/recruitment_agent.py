"""Main AI recruitment agent orchestrating communication, scheduling, and analytics."""

from datetime import datetime, timedelta
from typing import Optional

from .analytics.data_collector import DataCollector
from .analytics.insights_engine import Insight, InsightsEngine
from .analytics.metrics import RecruitmentMetrics
from .communications import CommunicationService
from .models import Candidate, CandidateStatus, Interview, TimeSlot
from .scheduling import SchedulingService


class RecruitmentAgent:
    """AI agent that automates recruitment workflows and provides data-driven insights."""

    def __init__(self):
        self.analytics = DataCollector()
        self.communications = CommunicationService(self.analytics)
        self.scheduling = SchedulingService(self.analytics, self.communications)
        self.insights = InsightsEngine(self.analytics)

    def contact_candidate(
        self,
        candidate: Candidate,
        use_sms: bool = False,
    ) -> bool:
        """Reach out to candidate via email or SMS."""
        subject = f"Interview opportunity: {candidate.position}"
        body = f"Hi {candidate.name},\n\nWe'd like to schedule an interview for {candidate.position}. Please reply with your availability."
        if use_sms and candidate.phone:
            return self.communications.send_sms(candidate, body[:160], campaign_id="initial_contact")
        return self.communications.send_email(candidate, subject, body, campaign_id="initial_contact")

    def schedule_from_availability(
        self,
        candidate: Candidate,
        slots: list[TimeSlot],
    ) -> Optional[Interview]:
        """Check availability and schedule interview."""
        slot = self.scheduling.find_next_available_slot(slots)
        if not slot:
            return None
        interview = self.scheduling.schedule_interview(candidate, slot)
        candidate.status = CandidateStatus.SCHEDULED
        candidate.interview_scheduled_at = slot
        return interview

    def send_reminder(self, interview: Interview, candidate: Candidate) -> bool:
        """Send reminder before interview."""
        return self.scheduling.send_reminder(interview, candidate)

    def record_outcome(
        self,
        interview: Interview,
        completed: bool,
    ) -> None:
        """Record whether interview was completed or no-show."""
        if completed:
            self.scheduling.record_completed(interview)
        else:
            self.scheduling.record_no_show(interview)

    def get_insights(
        self,
        position: Optional[str] = None,
        days_back: int = 30,
    ) -> list[Insight]:
        """Get data-driven optimization insights."""
        return self.insights.get_insights(position=position, days_back=days_back)

    def get_metrics(
        self,
        position: Optional[str] = None,
        days_back: int = 30,
    ) -> RecruitmentMetrics:
        """Get recruitment KPIs."""
        return self.insights.get_metrics_summary(position=position, days_back=days_back)
