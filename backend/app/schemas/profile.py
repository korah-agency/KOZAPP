from __future__ import annotations

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

# Longueur du numero local (hors indicatif) par indicatif pays.
# Doit rester synchronisee avec lib/country-codes.ts (champ `length`) cote frontend.
PHONE_LOCAL_LENGTHS: dict[str, int] = {
    "+237": 9, "+221": 9, "+225": 10, "+241": 9, "+242": 9, "+243": 9,
    "+229": 8, "+228": 8, "+226": 8, "+223": 8, "+227": 8, "+235": 8,
    "+236": 8, "+240": 9, "+224": 9, "+261": 9, "+212": 9, "+216": 8,
    "+213": 9, "+33": 9, "+32": 9, "+41": 9, "+1": 10,
}
PHONE_BASIC_PATTERN = re.compile(r"^\+\d{6,18}$")
PLAN_SLUGS = {"decouverte", "starter", "business", "scale"}
# Le plus long indicatif d'abord, pour ne pas confondre par ex. +1 avec +12x.
_DIAL_CODES_BY_LENGTH = sorted(PHONE_LOCAL_LENGTHS, key=len, reverse=True)


def _validate_phone_number(v: str) -> str:
    if not PHONE_BASIC_PATTERN.match(v):
        raise ValueError("Numéro WhatsApp invalide.")

    dial = next((d for d in _DIAL_CODES_BY_LENGTH if v.startswith(d)), None)
    if dial is None:
        # Indicatif non répertorié : on retombe sur une longueur générique.
        local = v[1:]
        if not (7 <= len(local) <= 12):
            raise ValueError("Numéro WhatsApp invalide.")
        return v

    local = v[len(dial):]
    expected_length = PHONE_LOCAL_LENGTHS[dial]
    if len(local) != expected_length:
        raise ValueError(f"Le numéro doit contenir exactement {expected_length} chiffres après l'indicatif {dial}.")
    return v


class ProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    shop_name: str
    shop_description: str | None
    activity_type: str | None
    city: str | None
    delivery_zones: str | None
    address: str | None
    hours: str | None
    whatsapp_number: str | None
    whatsapp_phone_number_id: str | None
    agent_tone: str | None
    agent_language: str | None
    agent_welcome: str | None
    agent_info: str | None
    plan: str
    created_at: datetime


class ProfileUpdate(BaseModel):
    shop_name: str | None = None
    shop_description: str | None = None
    activity_type: str | None = None
    city: str | None = None
    delivery_zones: str | None = None
    address: str | None = None
    hours: str | None = None
    whatsapp_number: str | None = None
    agent_tone: str | None = None
    agent_language: str | None = None
    agent_welcome: str | None = None
    agent_info: str | None = None
    plan: str | None = None

    @field_validator("whatsapp_number")
    @classmethod
    def validate_whatsapp_number(cls, v: str | None) -> str | None:
        if v:
            return _validate_phone_number(v)
        return v

    @field_validator("plan")
    @classmethod
    def validate_plan(cls, v: str | None) -> str | None:
        if v and v not in PLAN_SLUGS:
            raise ValueError("Forfait inconnu.")
        return v
