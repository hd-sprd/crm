import enum
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Enum, ForeignKey, Text, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ActivityType(str, enum.Enum):
    email = "email"
    call = "call"
    meeting = "meeting"
    note = "note"
    task = "task"
    whatsapp = "whatsapp"


class RelatedToType(str, enum.Enum):
    lead = "lead"
    deal = "deal"
    contact = "contact"
    account = "account"


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    type: Mapped[ActivityType] = mapped_column(Enum(ActivityType), nullable=False)
    related_to_type: Mapped[RelatedToType] = mapped_column(Enum(RelatedToType), nullable=False)
    related_to_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Microsoft Graph message ID for linked emails
    ms_message_id: Mapped[str | None] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    assigned_user: Mapped["User | None"] = relationship("User", back_populates="activities")  # type: ignore[name-defined]

    @property
    def is_overdue(self) -> bool:
        if self.due_date and not self.completed_at:
            return datetime.now(timezone.utc) > self.due_date
        return False
