from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CustomerBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str | None
    whatsapp_phone: str


class OrderItemBase(BaseModel):
    product_id: uuid.UUID
    product_name: str
    quantity: int
    unit_price: float
    subtotal: float


class OrderItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int


class OrderItemRead(OrderItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


class OrderBase(BaseModel):
    customer_id: uuid.UUID
    delivery_address: str | None = None
    delivery_city: str | None = None
    delivery_neighborhood: str | None = None
    notes: str | None = None


class OrderCreate(OrderBase):
    items: list[OrderItemCreate]


class OrderStatusUpdate(BaseModel):
    status: str
    note: str | None = None
    notify_customer: bool = True


class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_number: str
    status: str
    subtotal: float
    total_amount: float
    currency: str
    delivery_address: str | None
    delivery_city: str | None
    delivery_neighborhood: str | None
    notes: str | None
    paid: bool
    paid_at: datetime | None
    delivered_at: datetime | None
    created_at: datetime
    customer: CustomerBrief
    items: list[OrderItemRead]


class OrderListResponse(BaseModel):
    items: list[OrderRead]
    total: int
    page: int
    page_size: int
