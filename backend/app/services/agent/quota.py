"""verifier_limite_quota -- controle serveur, pas un outil du modele : le
quota doit etre verifie AVANT tout appel payant, jamais laisse au jugement
de l'agent (meme raisonnement que le garde-fou de reponse)."""

import uuid
from calendar import monthrange
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile import Profile
from app.models.usage_counter import UsageCounter

# Grille de depart (chapitre 9 du cahier des charges) ; "scale" est vendu au
# devis, on retient un plafond haut plutot qu'illimite pour eviter tout abus.
PLAN_QUOTAS = {
    "decouverte": {"conversations": 100, "followups": 0},
    "starter": {"conversations": 800, "followups": 150},
    "business": {"conversations": 3000, "followups": 600},
    "scale": {"conversations": 20000, "followups": 5000},
}


def _current_period() -> tuple[date, date]:
    today = date.today()
    start = today.replace(day=1)
    end = today.replace(day=monthrange(today.year, today.month)[1])
    return start, end


async def _get_or_create_counter(db: AsyncSession, profile_id: uuid.UUID) -> UsageCounter:
    start, end = _current_period()
    result = await db.execute(
        select(UsageCounter).where(UsageCounter.profile_id == profile_id, UsageCounter.period_start == start)
    )
    counter = result.scalar_one_or_none()
    if not counter:
        counter = UsageCounter(profile_id=profile_id, period_start=start, period_end=end)
        db.add(counter)
        await db.flush()
    return counter


async def verifier_limite_quota(db: AsyncSession, profile: Profile) -> dict:
    quotas = PLAN_QUOTAS.get(profile.plan, PLAN_QUOTAS["decouverte"])
    counter = await _get_or_create_counter(db, profile.id)
    remaining = quotas["conversations"] - counter.conversations_count
    return {
        "allowed": remaining > 0,
        "remaining_conversations": max(remaining, 0),
        "plan": profile.plan,
        "approaching_limit": 0 < remaining <= max(1, quotas["conversations"] // 10),
    }


async def increment_conversation_usage(db: AsyncSession, profile_id: uuid.UUID) -> None:
    counter = await _get_or_create_counter(db, profile_id)
    counter.conversations_count = (counter.conversations_count or 0) + 1
    await db.flush()


async def increment_followup_usage(db: AsyncSession, profile_id: uuid.UUID) -> None:
    counter = await _get_or_create_counter(db, profile_id)
    counter.followups_count = (counter.followups_count or 0) + 1
    await db.flush()


async def get_quota_usage(db: AsyncSession, profile: Profile) -> dict:
    """Detail complet de consommation, pour l'affichage tableau de bord
    (distinct de verifier_limite_quota, qui ne renvoie que la decision
    allow/deny cote agent)."""
    quotas = PLAN_QUOTAS.get(profile.plan, PLAN_QUOTAS["decouverte"])
    counter = await _get_or_create_counter(db, profile.id)
    return {
        "plan": profile.plan,
        "conversations_used": counter.conversations_count,
        "conversations_limit": quotas["conversations"],
        "followups_used": counter.followups_count,
        "followups_limit": quotas["followups"],
        "period_start": counter.period_start.isoformat(),
        "period_end": counter.period_end.isoformat(),
    }
