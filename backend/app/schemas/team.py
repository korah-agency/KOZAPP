from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class TeamMemberInvite(BaseModel):
    email: EmailStr
    name: str | None = None
    role: str = "member"


class TeamMemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None
    role: str
    invited_at: datetime
    accepted_at: datetime | None
