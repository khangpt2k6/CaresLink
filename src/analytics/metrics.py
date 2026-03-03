"""Recruitment KPIs and metrics calculation."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
from sqlalchemy import text

from .data_collector import DataCollector


@dataclass
class RecruitmentMetrics:
    """Key recruitment metrics for optimization."""

    total_candidates: int
    emails_sent: int
    sms_sent: int
    response_rate_email: float
    response_rate_sms: float
    interviews_scheduled: int
    no_show_count: int
    no_show_rate: float
    avg_time_to_schedule_days: float
    total_cost: float
    cost_per_hire: float
    hires_count: int
    period_start: Optional[datetime]
    period_end: Optional[datetime]


class MetricsCalculator:
    """Computes recruitment KPIs from event data."""

    def __init__(self, collector: DataCollector):
        self.collector = collector

    def get_metrics(
        self,
        position: Optional[str] = None,
        days_back: int = 30,
    ) -> RecruitmentMetrics:
        """Calculate recruitment metrics for the given period."""
        session = self.collector.Session()
        try:
            period_end = datetime.utcnow()
            period_start = period_end - timedelta(days=days_back)

            query = """
                SELECT event_type, channel, candidate_id, position,
                       metadata_json, timestamp, cost
                FROM recruitment_events
                WHERE timestamp >= :start AND timestamp <= :end
            """
            params: dict = {"start": period_start, "end": period_end}
            if position:
                query += " AND (position = :pos OR position IS NULL)"
                params["pos"] = position

            df = pd.read_sql(text(query), session.connection(), params=params)

            if df.empty:
                return self._empty_metrics(period_start, period_end)

            # Count events by type/channel
            emails_sent = len(df[df["event_type"] == "email_sent"])
            sms_sent = len(df[df["event_type"] == "sms_sent"])
            email_opened = len(df[df["event_type"] == "email_opened"])
            sms_replied = len(df[df["event_type"] == "sms_replied"])
            interviews = len(df[df["event_type"] == "interview_scheduled"])
            no_shows = len(df[df["event_type"] == "interview_no_show"])
            hired_df = df[
                (df["event_type"] == "status_changed")
                & (df["metadata_json"].fillna("").str.contains("hired", case=False))
            ]
            hires = len(hired_df)

            # Unique candidates
            candidate_events = df[df["candidate_id"].notna()]
            total_candidates = candidate_events["candidate_id"].nunique() if not candidate_events.empty else 0

            # Response rates
            response_rate_email = (email_opened / emails_sent) if emails_sent else 0.0
            response_rate_sms = (sms_replied / sms_sent) if sms_sent else 0.0

            # No-show rate
            no_show_rate = (no_shows / interviews) if interviews else 0.0

            # Time to schedule (from availability to scheduled) - simplified
            avg_time_days = 2.0  # Placeholder; full impl would compute from timestamps

            total_cost = df["cost"].fillna(0).sum()
            cost_per_hire = (total_cost / hires) if hires else 0.0

            return RecruitmentMetrics(
                total_candidates=int(total_candidates),
                emails_sent=int(emails_sent),
                sms_sent=int(sms_sent),
                response_rate_email=round(response_rate_email, 2),
                response_rate_sms=round(response_rate_sms, 2),
                interviews_scheduled=int(interviews),
                no_show_count=int(no_shows),
                no_show_rate=round(no_show_rate, 2),
                avg_time_to_schedule_days=avg_time_days,
                total_cost=round(float(total_cost), 2),
                cost_per_hire=round(cost_per_hire, 2),
                hires_count=int(hires),
                period_start=period_start,
                period_end=period_end,
            )
        finally:
            session.close()

    def _empty_metrics(
        self,
        period_start: Optional[datetime],
        period_end: Optional[datetime],
    ) -> RecruitmentMetrics:
        return RecruitmentMetrics(
            total_candidates=0,
            emails_sent=0,
            sms_sent=0,
            response_rate_email=0.0,
            response_rate_sms=0.0,
            interviews_scheduled=0,
            no_show_count=0,
            no_show_rate=0.0,
            avg_time_to_schedule_days=0.0,
            total_cost=0.0,
            cost_per_hire=0.0,
            hires_count=0,
            period_start=period_start,
            period_end=period_end,
        )
