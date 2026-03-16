import enum
from datetime import datetime, date, timezone
from sqlalchemy import String, DateTime, Date, Enum, ForeignKey, Text, Integer, Numeric, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class DealType(str, enum.Enum):
    standard = "standard"
    barter = "barter"
    custom = "custom"


# Kept as reference; the DB column is now VARCHAR(100)
class DealStage(str, enum.Enum):
    lead_received = "lead_received"
    lead_qualification = "lead_qualification"
    account_created = "account_created"
    needs_assessment = "needs_assessment"
    feasibility_check = "feasibility_check"
    quote_preparation = "quote_preparation"
    quote_sent = "quote_sent"
    negotiation = "negotiation"
    order_confirmed = "order_confirmed"
    order_created_erp = "order_created_erp"
    artwork_approval = "artwork_approval"
    production_planning = "production_planning"
    in_production = "in_production"
    quality_check = "quality_check"
    shipped = "shipped"
    invoice_created = "invoice_created"
    payment_received = "payment_received"
    deal_closed_won = "deal_closed_won"
    lost = "lost"
    on_hold = "on_hold"


STAGE_ORDER = [
    "lead_received", "lead_qualification", "account_created",
    "needs_assessment", "feasibility_check", "quote_preparation",
    "quote_sent", "negotiation", "order_confirmed",
    "order_created_erp", "artwork_approval", "production_planning",
    "in_production", "quality_check", "shipped",
    "invoice_created", "payment_received", "deal_closed_won",
]


class Deal(Base):
    __tablename__ = "deals"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False, index=True)
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("contacts.id"), index=True)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[DealType] = mapped_column(Enum(DealType), default=DealType.standard, nullable=False)
    stage: Mapped[str] = mapped_column(String(100), default="lead_received", nullable=False)
    product_type: Mapped[str | None] = mapped_column(String(200))
    quantity: Mapped[int | None] = mapped_column(Integer)
    branding_requirements: Mapped[str | None] = mapped_column(Text)
    shipping_location: Mapped[str | None] = mapped_column(String(255))
    feasibility_checked: Mapped[bool] = mapped_column(Boolean, default=False)
    feasibility_notes: Mapped[str | None] = mapped_column(Text)
    quote_id: Mapped[int | None] = mapped_column(ForeignKey("quotes.id"), index=True)
    order_reference: Mapped[str | None] = mapped_column(String(200))
    artwork_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    invoice_reference: Mapped[str | None] = mapped_column(String(200))
    payment_received: Mapped[bool] = mapped_column(Boolean, default=False)
    value_eur: Mapped[float | None] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="EUR", nullable=False)
    exchange_rate_eur: Mapped[float] = mapped_column(Numeric(10, 6), default=1.0, nullable=False)
    probability: Mapped[int] = mapped_column(Integer, default=0)
    expected_close_date: Mapped[date | None] = mapped_column(Date)
    lost_reason: Mapped[str | None] = mapped_column(Text)
    jira_ticket_id: Mapped[str | None] = mapped_column(String(100))
    custom_fields: Mapped[dict | None] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    account: Mapped["Account"] = relationship("Account", back_populates="deals")  # type: ignore[name-defined]
    contact: Mapped["Contact | None"] = relationship("Contact", back_populates="deals")  # type: ignore[name-defined]
    assigned_user: Mapped["User | None"] = relationship("User", back_populates="deals")  # type: ignore[name-defined]
    quotes: Mapped[list["Quote"]] = relationship("Quote", back_populates="deal", foreign_keys="Quote.deal_id")  # type: ignore[name-defined]
    active_quote: Mapped["Quote | None"] = relationship("Quote", foreign_keys=[quote_id], primaryjoin="Deal.quote_id == Quote.id")  # type: ignore[name-defined]
