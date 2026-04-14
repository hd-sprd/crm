import enum
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Enum, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class AccountType(str, enum.Enum):
    b2b = "b2b"
    b2b2c = "b2b2c"


class AccountStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    prospect = "prospect"


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    type: Mapped[AccountType] = mapped_column(Enum(AccountType), nullable=False)
    segment: Mapped[str | None] = mapped_column(String(100))
    industry: Mapped[str | None] = mapped_column(String(100))
    website: Mapped[str | None] = mapped_column(String(500))
    address: Mapped[str | None] = mapped_column(Text)
    country: Mapped[str | None] = mapped_column(String(100))
    region: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[AccountStatus] = mapped_column(Enum(AccountStatus), default=AccountStatus.prospect)
    account_manager_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    jira_ticket_id: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    custom_fields: Mapped[dict | None] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    account_manager: Mapped["User | None"] = relationship(  # type: ignore[name-defined]
        "User", back_populates="managed_accounts", foreign_keys=[account_manager_id]
    )
    contacts: Mapped[list["Contact"]] = relationship("Contact", back_populates="account", cascade="all, delete-orphan")  # type: ignore[name-defined]
    leads: Mapped[list["Lead"]] = relationship("Lead", back_populates="account")  # type: ignore[name-defined]
    deals: Mapped[list["Deal"]] = relationship("Deal", back_populates="account")  # type: ignore[name-defined]
