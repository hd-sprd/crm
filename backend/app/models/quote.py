import enum
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Enum, ForeignKey, Integer, Numeric, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class QuoteStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    negotiating = "negotiating"
    accepted = "accepted"
    rejected = "rejected"


class Quote(Base):
    __tablename__ = "quotes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey("deals.id"), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    line_items: Mapped[list] = mapped_column(JSON, default=list)
    # line_items: [{"product": str, "qty": int, "unit_price": float, "total": float}]
    shipping_cost: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    production_cost: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    total_value: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[QuoteStatus] = mapped_column(Enum(QuoteStatus), default=QuoteStatus.draft, nullable=False)
    payment_terms: Mapped[str | None] = mapped_column(String(500))
    validity_days: Mapped[int] = mapped_column(Integer, default=30)
    notes: Mapped[str | None] = mapped_column(String(2000))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    deal: Mapped["Deal"] = relationship("Deal", back_populates="quotes", foreign_keys=[deal_id])  # type: ignore[name-defined]
