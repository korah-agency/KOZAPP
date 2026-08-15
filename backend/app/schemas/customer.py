from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CustomerBase(BaseModel):
    whatsapp_phone: str
    name: str | None = None
    city: str | None = None
    neighborhood: str | None = None
    address: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: str | None = None
    city: str | None = None
    neighborhood: str | None = None
    address: str | None = None


class CustomerRead(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    total_orders: int
    total_spent: float
    last_order_at: datetime | None
    created_at: datetime
