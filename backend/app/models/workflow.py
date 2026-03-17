from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Integer, Boolean, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Stage key to advance deal to when its quote is accepted (None = no auto-advance)
    quote_approval_target_stage: Mapped[str | None] = mapped_column(String(100))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    stages: Mapped[list["WorkflowStage"]] = relationship(
        "WorkflowStage",
        back_populates="workflow",
        order_by="WorkflowStage.stage_order",
        cascade="all, delete-orphan",
    )


class WorkflowStage(Base):
    __tablename__ = "workflow_stages"
    __table_args__ = (UniqueConstraint("workflow_id", "key", name="uq_workflow_stage_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    workflow_id: Mapped[int] = mapped_column(ForeignKey("workflows.id"), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    label_en: Mapped[str] = mapped_column(String(200), nullable=False)
    label_de: Mapped[str] = mapped_column(String(200), nullable=False)
    color: Mapped[str] = mapped_column(String(50), default="blue")
    stage_order: Mapped[int] = mapped_column(Integer, nullable=False)
    is_won: Mapped[bool] = mapped_column(Boolean, default=False)
    is_lost: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Stage gate requirements (configurable per stage)
    requires_quote: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_approved_quote: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_feasibility: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_artwork: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_invoice: Mapped[bool] = mapped_column(Boolean, default=False)

    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="stages")
