from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class CustomerBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str | None
    whatsapp_phone: str


class WhatsAppSendRequest(BaseModel):
    phone_number: str
    message: str
    message_type: str = "text"


class WhatsAppSendResponse(BaseModel):
    success: bool
    message_id: str | None = None
    error: str | None = None


class ConversationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    state: str
    context: dict[str, Any] | None
    last_message_at: datetime | None
    created_at: datetime
    customer: CustomerBrief


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    direction: str
    message_type: str
    content: str
    status: str | None
    created_at: datetime
