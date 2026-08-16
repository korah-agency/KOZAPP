"""Boucle d'orchestration de l'agent : message -> contexte -> modele ->
outils -> reponse. Remplace l'automate a mots-cles precedent."""

import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.customer import Customer
from app.models.profile import Profile
from app.models.whatsapp_conversation import WhatsAppConversation
from app.models.whatsapp_message import WhatsAppMessage
from app.services.agent.guardrail import verifier_reponse_avant_envoi
from app.services.agent.openrouter import OpenRouterError, audio_content_part, chat_completion
from app.services.agent.prompt import build_system_prompt
from app.services.agent.quota import verifier_limite_quota
from app.services.agent.tools import TOOL_FUNCTIONS, TOOL_SCHEMAS, ToolContext, ToolError

logger = logging.getLogger(__name__)

HISTORY_MESSAGE_COUNT = 10

QUOTA_EXCEEDED_REPLY = (
    "Merci pour votre message ! Notre agent automatique a atteint sa limite d'echanges pour ce mois-ci. "
    "Un membre de notre equipe vous repondra directement."
)
AGENT_DISABLED_REPLY = None  # aucune reponse automatique si l'agent est desactive pour cette boutique
GENERIC_ERROR_REPLY = (
    "Desole, je rencontre une difficulte technique passagere. Reessayez dans un instant, "
    "ou notre equipe reviendra vers vous rapidement."
)


async def _recent_history(db: AsyncSession, conversation: WhatsAppConversation) -> list[dict]:
    result = await db.execute(
        select(WhatsAppMessage)
        .where(WhatsAppMessage.conversation_id == conversation.id)
        .order_by(WhatsAppMessage.created_at.desc())
        .limit(HISTORY_MESSAGE_COUNT)
    )
    messages = list(reversed(result.scalars().all()))
    history = []
    for m in messages:
        role = "user" if m.direction == "incoming" else "assistant"
        content = m.transcript if m.message_type == "audio" and m.transcript else m.content
        history.append({"role": role, "content": content})
    return history


async def run_agent_turn(
    db: AsyncSession,
    profile: Profile,
    customer: Customer,
    conversation: WhatsAppConversation,
    user_text: str | None = None,
    audio_bytes: bytes | None = None,
    audio_format: str = "ogg",
) -> str | None:
    """Retourne le texte a envoyer au client, ou None si rien ne doit etre
    envoye (agent desactive)."""
    if not profile.agent_enabled:
        return AGENT_DISABLED_REPLY

    quota = await verifier_limite_quota(db, profile)
    if not quota["allowed"]:
        return QUOTA_EXCEEDED_REPLY

    system_prompt = build_system_prompt(profile, customer)
    if conversation.summary:
        system_prompt += f"\n\nResume de la conversation jusqu'ici : {conversation.summary}"

    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    messages.extend(await _recent_history(db, conversation))

    if audio_bytes:
        # Le modele (Gemini) comprend l'audio nativement : pas d'etape de
        # transcription separee, l'audio fait partie du contenu du tour.
        messages.append(
            {
                "role": "user",
                "content": [
                    audio_content_part(audio_bytes, audio_format),
                    {"type": "text", "text": "(note vocale du client)"},
                ],
            }
        )
    else:
        messages.append({"role": "user", "content": user_text or ""})

    model = profile.agent_model or settings.AGENT_MODEL_DEFAULT
    tool_ctx = ToolContext(db=db, profile=profile, customer=customer, conversation=conversation)

    for _ in range(settings.AGENT_MAX_TOOL_ITERATIONS):
        try:
            assistant_message = await chat_completion(messages=messages, tools=TOOL_SCHEMAS, model=model)
        except OpenRouterError:
            logger.exception("Echec appel OpenRouter pour la boutique %s", profile.id)
            return GENERIC_ERROR_REPLY

        tool_calls = assistant_message.get("tool_calls")
        if not tool_calls:
            final_text = (assistant_message.get("content") or "").strip()
            if not final_text:
                return GENERIC_ERROR_REPLY
            ok, safe_text = await verifier_reponse_avant_envoi(db, profile.id, final_text)
            return safe_text

        messages.append(assistant_message)
        for call in tool_calls:
            fn_name = call["function"]["name"]
            try:
                raw_args = call["function"].get("arguments") or "{}"
                args = json.loads(raw_args)
            except json.JSONDecodeError:
                args = {}

            func = TOOL_FUNCTIONS.get(fn_name)
            if not func:
                result_payload = {"error": f"Outil inconnu : {fn_name}"}
            else:
                try:
                    result_payload = await func(tool_ctx, **args)
                except ToolError as exc:
                    result_payload = {"error": str(exc)}
                except TypeError as exc:
                    logger.warning("Arguments invalides pour %s: %s", fn_name, exc)
                    result_payload = {"error": "Arguments invalides pour cet outil."}
                except Exception:
                    logger.exception("Erreur inattendue dans l'outil %s", fn_name)
                    result_payload = {"error": "Erreur technique lors de l'execution de l'outil."}

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call["id"],
                    "content": json.dumps(result_payload, ensure_ascii=False, default=str),
                }
            )

    logger.warning("Limite d'iterations d'outils atteinte pour la boutique %s", profile.id)
    return GENERIC_ERROR_REPLY
