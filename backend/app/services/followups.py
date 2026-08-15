"""Service de relances : verifier_regles_relance, envoyer_relance,
enregistrer_resultat_relance -- plus le cycle de planificateur qui les
enchaine. Ces trois fonctions ne sont PAS des outils appelables par l'agent
conversationnel (elles s'executent en tache de fond, hors d'un tour de
conversation), mais elles repondent aux memes fonctions decrites dans le
cahier des charges."""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.customer import Customer
from app.models.followup_rule import FollowupRule
from app.models.followup_send import FollowupSend
from app.models.profile import Profile
from app.models.whatsapp_conversation import WhatsAppConversation
from app.services.agent.quota import increment_followup_usage
from app.services.whatsapp import send_whatsapp_template

logger = logging.getLogger(__name__)

FOLLOWUP_COOLDOWN_HOURS = 24


async def verifier_regles_relance(db: AsyncSession, profile: Profile) -> list[FollowupRule]:
    result = await db.execute(
        select(FollowupRule).where(FollowupRule.profile_id == profile.id, FollowupRule.is_active.is_(True))
    )
    return list(result.scalars().all())


async def _eligible_customers(db: AsyncSession, rule: FollowupRule) -> list[Customer]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=rule.delay_hours)
    recent_send_cutoff = datetime.now(timezone.utc) - timedelta(hours=FOLLOWUP_COOLDOWN_HOURS)

    already_sent = select(FollowupSend.customer_id).where(
        FollowupSend.rule_id == rule.id, FollowupSend.sent_at >= recent_send_cutoff
    )

    if rule.trigger_type == "panier_abandonne":
        query = (
            select(Customer)
            .join(WhatsAppConversation, WhatsAppConversation.customer_id == Customer.id)
            .where(
                Customer.profile_id == rule.profile_id,
                Customer.opt_out.is_(False),
                WhatsAppConversation.outcome.in_(["en_cours", "negociation"]),
                WhatsAppConversation.last_message_at <= cutoff,
                Customer.id.notin_(already_sent),
            )
        )
    else:
        # client_inactif / renouvellement : le client a deja commande, mais
        # plus rien depuis "delay_hours". La distinction fine entre les deux
        # (relancer pour la premiere fois vs. cycle de reachat regulier)
        # depend du produit vendu et reste a affiner avec le pilote La Dame ;
        # la meme condition de base couvre les deux au demarrage.
        query = select(Customer).where(
            Customer.profile_id == rule.profile_id,
            Customer.opt_out.is_(False),
            Customer.last_order_at.isnot(None),
            Customer.last_order_at <= cutoff,
            Customer.id.notin_(already_sent),
        )

    result = await db.execute(query)
    return list(result.scalars().unique().all())


async def envoyer_relance(db: AsyncSession, profile: Profile, rule: FollowupRule, customer: Customer) -> FollowupSend | None:
    if not rule.template or rule.template.approval_status != "approved":
        logger.info(
            "Regle de relance %s sans modele Meta approuve, envoi ignore (boutique %s)", rule.id, profile.id
        )
        return None
    if not profile.whatsapp_token or not profile.whatsapp_phone_number_id:
        return None

    result = await send_whatsapp_template(
        customer.whatsapp_phone,
        rule.template.name,
        token=profile.whatsapp_token,
        phone_number_id=profile.whatsapp_phone_number_id,
        language_code=rule.template.language_code,
    )
    send = FollowupSend(
        profile_id=profile.id,
        rule_id=rule.id,
        customer_id=customer.id,
        whatsapp_status="sent" if result.get("success") else "failed",
    )
    db.add(send)
    await increment_followup_usage(db, profile.id)
    await db.flush()
    return send


async def enregistrer_resultat_relance(db: AsyncSession, send: FollowupSend, result: str) -> None:
    send.result = result
    send.result_recorded_at = datetime.now(timezone.utc)
    await db.flush()


async def mark_followups_answered(db: AsyncSession, customer: Customer, outcome: str) -> None:
    """Appele apres qu'un client relance ecrit de nouveau : cloture la
    derniere relance en attente comme 'repondu' (ou 'commande' si la
    conversation vient d'aboutir a une commande)."""
    result = await db.execute(
        select(FollowupSend)
        .where(FollowupSend.customer_id == customer.id, FollowupSend.result == "en_attente")
        .order_by(FollowupSend.sent_at.desc())
    )
    pending = result.scalars().first()
    if pending:
        await enregistrer_resultat_relance(
            db, pending, "commande" if outcome == "commande_conclue" else "repondu"
        )


async def run_followup_cycle() -> None:
    """Point d'entree du planificateur de fond (voir main.py) : parcourt
    toutes les boutiques actives et envoie les relances dues, en etalant
    naturellement les envois puisque chaque appel ne traite que ce qui est
    du a l'instant present."""
    async with async_session() as db:
        try:
            result = await db.execute(select(Profile).where(Profile.is_active.is_(True), Profile.agent_enabled.is_(True)))
            profiles = result.scalars().all()
            for profile in profiles:
                await db.execute(
                    text("SELECT set_config('app.current_profile_id', :pid, true)"),
                    {"pid": str(profile.id)},
                )
                rules = await verifier_regles_relance(db, profile)
                for rule in rules:
                    customers = await _eligible_customers(db, rule)
                    for customer in customers:
                        await envoyer_relance(db, profile, rule, customer)
            await db.commit()
        except Exception:
            logger.exception("Echec du cycle de relances")
            await db.rollback()
