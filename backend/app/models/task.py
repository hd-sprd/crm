import enum
from datetime import datetime, date, timezone
from sqlalchemy import String, DateTime, Date, Enum, ForeignKey, Text, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class TaskStatus(str, enum.Enum):
    open = "open"
    completed = "completed"


class RelatedToType(str, enum.Enum):
    lead = "lead"
    deal = "deal"
    contact = "contact"
    account = "account"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    related_to_type: Mapped[RelatedToType | None] = mapped_column(Enum(RelatedToType))
    related_to_id: Mapped[int | None] = mapped_column(Integer, index=True)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    due_date: Mapped[date | None] = mapped_column(Date)
    priority: Mapped[TaskPriority] = mapped_column(Enum(TaskPriority), default=TaskPriority.medium, nullable=False)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), default=TaskStatus.open, nullable=False)
    is_auto_generated: Mapped[bool] = mapped_column(Boolean, default=False)  # from workflow engine

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    assigned_user: Mapped["User | None"] = relationship("User", back_populates="tasks")  # type: ignore[name-defined]
