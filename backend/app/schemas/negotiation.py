from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class NegotiationRuleUpsert(BaseModel):
    is_negotiable: bool = False
    floor_price: float = Field(ge=0)
    max_discount_pct: float = Field(ge=0, le=100, default=0)


class NegotiationRuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    is_negotiable: bool
    floor_price: float
    max_discount_pct: float
