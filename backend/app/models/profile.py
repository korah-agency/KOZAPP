import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    shop_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    shop_description: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(50))
    activity_type: Mapped[str | None] = mapped_column(String(50), default="restauration")
    city: Mapped[str | None] = mapped_column(String(100))
    delivery_zones: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(Text)
    hours: Mapped[str | None] = mapped_column(Text)
    whatsapp_number: Mapped[str | None] = mapped_column(String(50))
    whatsapp_phone_number_id: Mapped[str | None] = mapped_column(String(50))
    whatsapp_waba_id: Mapped[str | None] = mapped_column(String(50))
    whatsapp_token: Mapped[str | None] = mapped_column(Text)
    whatsapp_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    agent_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    agent_model: Mapped[str | None] = mapped_column(String(100))
    agent_tone: Mapped[str | None] = mapped_column(String(50), default="Chaleureux")
    agent_language: Mapped[str | None] = mapped_column(String(10), default="fr")
    agent_welcome: Mapped[str | None] = mapped_column(Text)
    agent_info: Mapped[str | None] = mapped_column(Text)
    opening_hours: Mapped[dict | None] = mapped_column(JSONB)
    plan: Mapped[str] = mapped_column(String(20), nullable=False, default="decouverte", server_default="decouverte")
    reset_token_hash: Mapped[str | None] = mapped_column(String(64))
    reset_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
