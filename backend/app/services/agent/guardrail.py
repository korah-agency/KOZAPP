"""Le garde-fou final avant envoi (verifier_reponse_avant_envoi).

Volontairement PAS un outil que le modele peut choisir d'appeler : un
garde-fou qu'on peut decider de ne pas invoquer n'en est pas un. C'est un
controle serveur systematique, applique a chaque reponse generee, juste
avant l'envoi WhatsApp.

Verifie deux choses :
1. Aucun montant en FCFA cite dans la reponse ne descend sous le prix
   plancher le plus bas parmi les regles de negociation actives de la
   boutique (heuristique volontairement conservatrice : en cas de doute,
   on bloque plutot que de laisser passer un prix casse).
2. Aucune formule de promesse interdite (garantie, remboursement immediat,
   gratuit a vie...) qui engagerait le commercant au-dela de ce qu'il a
   configure.
"""

import logging
import re
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog
from app.models.negotiation_rule import NegotiationRule

logger = logging.getLogger(__name__)

_PRICE_PATTERN = re.compile(r"(\d[\d\s.,]{1,10})\s?(?:FCFA|F\s?CFA|Fcfa)", re.IGNORECASE)

_FORBIDDEN_PHRASES = [
    "garanti a vie",
    "garantie a vie",
    "remboursement immediat",
    "remboursement garanti",
    "gratuit a vie",
    "sans aucun risque",
    "promesse ferme de livraison",
]

NEUTRAL_FALLBACK = (
    "Je transmets votre demande a notre equipe pour vous donner une reponse precise, "
    "un instant s'il vous plait."
)


def _parse_amount(raw: str) -> float | None:
    cleaned = raw.strip().replace(" ", "").replace(".", "").replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


async def verifier_reponse_avant_envoi(
    db: AsyncSession, profile_id: uuid.UUID, response_text: str
) -> tuple[bool, str]:
    """Renvoie (ok, texte_a_envoyer). Si ok est False, le texte a deja ete
    remplace par la reponse neutre et le blocage a ete journalise."""
    lowered = response_text.lower()
    for phrase in _FORBIDDEN_PHRASES:
        if phrase in lowered:
            await _log_block(db, profile_id, "promesse_interdite", {"phrase": phrase})
            return False, NEUTRAL_FALLBACK

    prices = [_parse_amount(m) for m in _PRICE_PATTERN.findall(response_text)]
    prices = [p for p in prices if p is not None]
    if prices:
        result = await db.execute(
            select(func.min(NegotiationRule.floor_price)).where(
                NegotiationRule.profile_id == profile_id,
                NegotiationRule.is_negotiable.is_(True),
            )
        )
        min_floor = result.scalar_one_or_none()
        if min_floor is not None:
            below = [p for p in prices if p < float(min_floor)]
            if below:
                await _log_block(
                    db, profile_id, "prix_sous_plancher", {"prices": below, "min_floor": float(min_floor)}
                )
                return False, NEUTRAL_FALLBACK

    return True, response_text


async def _log_block(db: AsyncSession, profile_id: uuid.UUID, reason: str, detail: dict) -> None:
    logger.warning("Garde-fou : reponse bloquee (%s) pour la boutique %s", reason, profile_id)
    db.add(
        ActivityLog(
            profile_id=profile_id,
            actor="agent",
            action="guardrail_blocked",
            detail={"reason": reason, **detail},
        )
    )
    await db.flush()
