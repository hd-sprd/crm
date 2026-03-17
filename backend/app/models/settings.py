from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Integer, Boolean, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    value: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class CustomFieldDef(Base):
    __tablename__ = "custom_field_defs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    label_en: Mapped[str] = mapped_column(String(200), nullable=False)
    label_de: Mapped[str] = mapped_column(String(200), nullable=False)
    field_type: Mapped[str] = mapped_column(String(50), nullable=False)  # text, number, date, select, checkbox
    applies_to: Mapped[str] = mapped_column(String(50), nullable=False)  # deal, lead, contact
    options: Mapped[list | None] = mapped_column(JSON)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    field_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
