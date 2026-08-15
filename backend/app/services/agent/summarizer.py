"""resumer_conversation -- declenche par le pipeline sur seuil de longueur,
jamais a la discretion du modele (sinon l'economie de cout recherchee n'a
jamais lieu). Condense l'historique en un resume court, pour ne pas
renvoyer toute la conversation a chaque nouveau message."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.whatsapp_conversation import WhatsAppConversation
from app.models.whatsapp_message import WhatsAppMessage
from app.services.agent.openrouter import OpenRouterError, chat_completion

logger = logging.getLogger(__name__)


async def maybe_summarize(db: AsyncSession, conversation: WhatsAppConversation) -> None:
    if (conversation.message_count or 0) < settings.AGENT_SUMMARY_TRIGGER_MESSAGES:
        return

    query = select(WhatsAppMessage).where(WhatsAppMessage.conversation_id == conversation.id)
    if conversation.summary_upto_message_id:
        anchor = await db.execute(
            select(WhatsAppMessage.created_at).where(WhatsAppMessage.id == conversation.summary_upto_message_id)
        )
        anchor_at = anchor.scalar_one_or_none()
        if anchor_at:
            query = query.where(WhatsAppMessage.created_at > anchor_at)
    query = query.order_by(WhatsAppMessage.created_at)

    result = await db.execute(query)
    messages = result.scalars().all()
    if len(messages) < settings.AGENT_SUMMARY_TRIGGER_MESSAGES:
        return

    transcript = "\n".join(
        f"{'Client' if m.direction == 'incoming' else 'Agent'}: {m.content}" for m in messages
    )
    prompt = (
        "Resume cette portion de conversation commerciale WhatsApp en 3 phrases maximum : "
        "ce que le client cherche, ou en est la negociation/commande le cas echeant, et le "
        "point ouvert le plus recent. Sois factuel, pas de formules de politesse.\n\n"
        f"Resume precedent : {conversation.summary or '(aucun)'}\n\n"
        f"Nouveaux echanges :\n{transcript}"
    )

    try:
        message = await chat_completion(
            messages=[{"role": "user", "content": prompt}],
            model=settings.AGENT_MODEL_DEFAULT,
            temperature=0.2,
        )
    except OpenRouterError as exc:
        logger.warning("Resume de conversation echoue, on garde l'ancien resume : %s", exc)
        return

    conversation.summary = (message.get("content") or "").strip() or conversation.summary
    conversation.summary_upto_message_id = messages[-1].id
    await db.flush()
