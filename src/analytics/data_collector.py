"""Collects recruitment events for data-driven analytics."""

from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import Column, DateTime, Float, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()


class RecruitmentEvent(Base):
    """Stored recruitment event for analytics."""

    __tablename__ = "recruitment_events"

    id = Column(String, primary_key=True)
    event_type = Column(String, index=True, nullable=False)
    candidate_id = Column(String, index=True)
    position = Column(String, index=True)
    channel = Column(String, index=True)  # email, sms, phone
    metadata_json = Column(String)  # JSON string for extra context
    timestamp = Column(DateTime, default=datetime.utcnow)
    # For A/B testing or campaign tracking
    campaign_id = Column(String, index=True)
    cost = Column(Float, default=0.0)  # Cost per action for ROI tracking


class DataCollector:
    """Collects and persists recruitment events for insights."""

    def __init__(self, db_path: Optional[str] = None):
        db = db_path or str(Path(__file__).parent.parent.parent / "data" / "careslink.db")
        Path(db).parent.mkdir(parents=True, exist_ok=True)
        self.engine = create_engine(f"sqlite:///{db}", echo=False)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)

    def log_event(
        self,
        event_type: str,
        candidate_id: Optional[str] = None,
        position: Optional[str] = None,
        channel: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        campaign_id: Optional[str] = None,
        cost: float = 0.0,
    ) -> None:
        """Log a recruitment event for later analysis."""
        import json
        import uuid

        session = self.Session()
        try:
            event = RecruitmentEvent(
                id=str(uuid.uuid4()),
                event_type=event_type,
                candidate_id=candidate_id,
                position=position,
                channel=channel,
                metadata_json=json.dumps(metadata or {}),
                campaign_id=campaign_id,
                cost=cost,
            )
            session.add(event)
            session.commit()
        finally:
            session.close()
