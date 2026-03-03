"""Generates actionable insights for recruitment optimization."""

from dataclasses import dataclass
from typing import Optional

from .data_collector import DataCollector
from .metrics import MetricsCalculator, RecruitmentMetrics


@dataclass
class Insight:
    """Single optimization insight."""
    title: str
    description: str
    metric: str
    current_value: str
    recommended_action: str
    priority: str  # high, medium, low


class InsightsEngine:
    """Analyzes metrics and produces data-driven optimization recommendations."""

    def __init__(self, collector: DataCollector):
        self.calculator = MetricsCalculator(collector)

    def get_insights(
        self,
        position: Optional[str] = None,
        days_back: int = 30,
    ) -> list[Insight]:
        """Generate actionable insights from recruitment data."""
        metrics = self.calculator.get_metrics(position=position, days_back=days_back)
        insights: list[Insight] = []

        # No-show rate optimization
        if metrics.no_show_rate > 0.15:
            insights.append(Insight(
                title="High No-Show Rate",
                description=f"Your interview no-show rate is {metrics.no_show_rate:.0%}, above the 15% benchmark.",
                metric="no_show_rate",
                current_value=f"{metrics.no_show_rate:.0%}",
                recommended_action="Enable SMS reminders 24h before interviews; consider a confirmation reply flow.",
                priority="high",
            ))
        elif metrics.no_show_rate > 0 and metrics.no_show_rate <= 0.15:
            insights.append(Insight(
                title="No-Show Rate in Line",
                description=f"No-show rate is {metrics.no_show_rate:.0%}. Room to improve with more reminders.",
                metric="no_show_rate",
                current_value=f"{metrics.no_show_rate:.0%}",
                recommended_action="Add a 1-hour-before SMS reminder to further reduce no-shows.",
                priority="low",
            ))

        # Channel effectiveness
        if metrics.emails_sent > 5 or metrics.sms_sent > 5:
            if metrics.response_rate_sms > metrics.response_rate_email:
                insights.append(Insight(
                    title="SMS Outperforms Email",
                    description=f"SMS response rate ({metrics.response_rate_sms:.0%}) beats email ({metrics.response_rate_email:.0%}).",
                    metric="response_rate",
                    current_value=f"SMS: {metrics.response_rate_sms:.0%}, Email: {metrics.response_rate_email:.0%}",
                    recommended_action="Prioritize SMS for time-sensitive outreach (scheduling, reminders).",
                    priority="high",
                ))
            elif metrics.response_rate_email > metrics.response_rate_sms and metrics.sms_sent > 0:
                insights.append(Insight(
                    title="Email Outperforms SMS",
                    description=f"Email response rate ({metrics.response_rate_email:.0%}) beats SMS ({metrics.response_rate_sms:.0%}).",
                    metric="response_rate",
                    current_value=f"Email: {metrics.response_rate_email:.0%}, SMS: {metrics.response_rate_sms:.0%}",
                    recommended_action="Use email for initial contact; reserve SMS for reminders only.",
                    priority="medium",
                ))

        # Cost optimization
        if metrics.hires_count > 0 and metrics.cost_per_hire > 500:
            insights.append(Insight(
                title="High Cost Per Hire",
                description=f"Cost per hire is ${metrics.cost_per_hire:.0f}, above typical $300–500 range.",
                metric="cost_per_hire",
                current_value=f"${metrics.cost_per_hire:.0f}",
                recommended_action="Automate more touchpoints; batch similar interviews; reduce manual outreach.",
                priority="high",
            ))

        # Low response rate
        if metrics.emails_sent >= 3 and metrics.response_rate_email < 0.2:
            insights.append(Insight(
                title="Low Email Response Rate",
                description=f"Only {metrics.response_rate_email:.0%} of emails get responses.",
                metric="response_rate_email",
                current_value=f"{metrics.response_rate_email:.0%}",
                recommended_action="Improve subject lines; send at optimal times (Tue–Thu 10–11am); add SMS follow-up.",
                priority="high",
            ))

        # Scheduling efficiency
        if metrics.interviews_scheduled > 0 and metrics.avg_time_to_schedule_days > 3:
            insights.append(Insight(
                title="Slow Time-to-Schedule",
                description=f"Average {metrics.avg_time_to_schedule_days:.0f} days from availability to scheduled interview.",
                metric="avg_time_to_schedule_days",
                current_value=f"{metrics.avg_time_to_schedule_days:.0f} days",
                recommended_action="Use real-time availability links; auto-suggest next available slots.",
                priority="medium",
            ))

        # Sort by priority
        priority_order = {"high": 0, "medium": 1, "low": 2}
        insights.sort(key=lambda i: priority_order.get(i.priority, 3))
        return insights

    def get_metrics_summary(
        self,
        position: Optional[str] = None,
        days_back: int = 30,
    ) -> RecruitmentMetrics:
        """Convenience method to get metrics."""
        return self.calculator.get_metrics(position=position, days_back=days_back)
