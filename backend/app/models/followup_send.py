import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FollowupSend(Base):
    __tablename__ = "followup_sends"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("followup_rules.id", ondelete="CASCADE"), index=True
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), index=True
    )
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("whatsapp_conversations.id", ondelete="SET NULL")
    )
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    whatsapp_status: Mapped[str | None] = mapped_column(String(30))
    result: Mapped[str] = mapped_column(String(20), default="en_attente")
    """en_attente | repondu | commande | sans_effet"""
    result_recorded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    rule = relationship("FollowupRule", lazy="selectin")
    customer = relationship("Customer", lazy="selectin")
