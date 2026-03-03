"""CaresLink - AI Recruitment Agent. Run demo and view insights."""

import sys
from pathlib import Path

# Ensure src is on path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.models import Candidate, CandidateStatus, TimeSlot
from src.recruitment_agent import RecruitmentAgent


def run_demo() -> None:
    """Run a quick demo of the recruitment agent and insights."""
    agent = RecruitmentAgent()

    # Create sample candidate
    candidate = Candidate(
        id="cand-001",
        name="Jane Doe",
        email="jane.doe@example.com",
        phone="+15551234567",
        position="Software Engineer",
    )

    print("=== CaresLink AI Recruitment Agent Demo ===\n")

    # 1. Contact candidate
    print("1. Contacting candidate...")
    agent.contact_candidate(candidate)
    agent.contact_candidate(candidate, use_sms=True)
    print("   -> Sent email and SMS\n")

    # 2. Simulate availability and schedule
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    slots = [
        TimeSlot(start=now + timedelta(days=1, hours=10), end=now + timedelta(days=1, hours=11)),
        TimeSlot(start=now + timedelta(days=2, hours=14), end=now + timedelta(days=2, hours=15)),
    ]
    interview = agent.schedule_from_availability(candidate, slots)
    if interview:
        print("2. Scheduled interview at:", interview.scheduled_at.strftime("%Y-%m-%d %H:%M"))
        agent.send_reminder(interview, candidate)
        print("   -> Reminder sent\n")

    # 3. Simulate some outcomes for richer metrics
    agent.analytics.log_event("interview_no_show", candidate_id="cand-002", position="Engineer")
    agent.analytics.log_event("email_opened", candidate_id=candidate.id, position=candidate.position, channel="email")
    agent.analytics.log_event("sms_replied", candidate_id=candidate.id, position=candidate.position, channel="sms")

    # 4. Data-driven insights
    print("3. Data-Driven Insights for Optimization\n")
    insights = agent.get_insights(days_back=7)
    for i, insight in enumerate(insights, 1):
        print(f"   [{insight.priority.upper()}] {insight.title}")
        print(f"   {insight.description}")
        print(f"   Action: {insight.recommended_action}\n")

    # 5. Metrics summary
    metrics = agent.get_metrics(days_back=7)
    print("4. Key Metrics")
    print(f"   Candidates: {metrics.total_candidates}")
    print(f"   Emails sent: {metrics.emails_sent} | SMS sent: {metrics.sms_sent}")
    print(f"   Response rate (email): {metrics.response_rate_email:.0%} | (SMS): {metrics.response_rate_sms:.0%}")
    print(f"   Interviews: {metrics.interviews_scheduled} | No-shows: {metrics.no_show_count} ({metrics.no_show_rate:.0%})")
    print(f"   Cost: ${metrics.total_cost} | Cost per hire: ${metrics.cost_per_hire}")
    print("\n=== Demo Complete ===")


if __name__ == "__main__":
    run_demo()
