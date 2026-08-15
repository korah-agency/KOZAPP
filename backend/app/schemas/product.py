from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProductBase(BaseModel):
    name: str
    description: str | None = None
    price: float
    image_url: str | None = None
    is_available: bool = True
    is_featured: bool = False
    category_id: uuid.UUID | None = None


class ProductCreate(ProductBase):
    slug: str | None = None  # auto-genere depuis le nom si absent


class ProductUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    price: float | None = None
    image_url: str | None = None
    is_available: bool | None = None
    is_featured: bool | None = None
    category_id: uuid.UUID | None = None


class CategoryBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str


class ProductRead(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    sold_count: int
    sort_order: int
    created_at: datetime
    category: CategoryBrief | None = None
