import enum
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class UserRole(str, enum.Enum):
    sales_rep = "sales_rep"
    account_manager = "account_manager"
    sales_manager = "sales_manager"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.sales_rep, nullable=False)
    region: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Microsoft Graph token storage
    ms_graph_token: Mapped[str | None] = mapped_column(String(4096))
    ms_graph_refresh_token: Mapped[str | None] = mapped_column(String(4096))
    ms_graph_token_expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    managed_accounts: Mapped[list["Account"]] = relationship(  # type: ignore[name-defined]
        "Account", back_populates="account_manager", foreign_keys="Account.account_manager_id"
    )
    leads: Mapped[list["Lead"]] = relationship("Lead", back_populates="assigned_user")  # type: ignore[name-defined]
    deals: Mapped[list["Deal"]] = relationship("Deal", back_populates="assigned_user")  # type: ignore[name-defined]
    activities: Mapped[list["Activity"]] = relationship("Activity", back_populates="assigned_user")  # type: ignore[name-defined]
    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="assigned_user")  # type: ignore[name-defined]
