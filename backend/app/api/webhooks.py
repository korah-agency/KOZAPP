import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.config import settings
from app.models.customer import Customer
from app.models.profile import Profile
from app.models.whatsapp_conversation import WhatsAppConversation
from app.models.whatsapp_message import WhatsAppMessage
from app.services.agent.engine import run_agent_turn
from app.services.agent.quota import increment_conversation_usage
from app.services.agent.summarizer import maybe_summarize
from app.services.followups import mark_followups_answered
from app.services.whatsapp import download_whatsapp_media, send_whatsapp_message

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("/whatsapp")
async def verify_webhook(
    hub_mode: str = Query("", alias="hub.mode"),
    hub_verify_token: str = Query("", alias="hub.verify_token"),
    hub_challenge: str = Query("", alias="hub.challenge"),
) -> str:
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        return hub_challenge
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Verification failed",
    )


def _verify_signature(raw_body: bytes, signature_header: str | None) -> bool:
    """Verifie X-Hub-Signature-256 (HMAC-SHA256 du corps brut avec l'App
    Secret Meta). Sans ce controle, n'importe qui connaissant l'URL du
    webhook peut injecter de faux messages et declencher de vraies
    commandes. En dev sans App Secret configure, on laisse passer pour ne
    pas bloquer les tests locaux ; en production, on refuse."""
    app_secret = settings.WHATSAPP_APP_SECRET
    if not app_secret:
        return settings.ENVIRONMENT != "production"
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    provided = signature_header.split("=", 1)[1]
    return hmac.compare_digest(expected, provided)


@router.post("/whatsapp")
async def receive_whatsapp_message(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    raw_body = await request.body()
    if not _verify_signature(raw_body, request.headers.get("x-hub-signature-256")):
        logger.warning("Signature webhook WhatsApp invalide, requete rejetee")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature")

    body = json.loads(raw_body or b"{}")
    entry = body.get("entry", [{}])[0]
    changes = entry.get("changes", [{}])[0]
    value = changes.get("value", {})
    messages = value.get("messages", [])
    statuses = value.get("statuses", [])

    phone_number_id = value.get("metadata", {}).get("phone_number_id")
    profile = await _get_profile_for_phone_number_id(db, phone_number_id)
    if not profile:
        logger.warning("Webhook recu pour un phone_number_id inconnu: %s", phone_number_id)
        return {"status": "ignored"}

    if messages:
        message = messages[0]
        # Meta rejoue parfois ses webhooks : sans ce controle, un rejeu
        # relancerait tout le pipeline agent (et pourrait doubler une commande).
        if await _already_processed(db, message.get("id")):
            return {"status": "duplicate_ignored"}
        contacts = value.get("contacts", [{}])
        contact_name = contacts[0].get("profile", {}).get("name", "") if contacts else ""
        await _handle_incoming_message(message, contact_name, profile, db)
    elif statuses:
        await _handle_status_update(statuses[0], db)
    return {"status": "ok"}


async def _already_processed(db: AsyncSession, whatsapp_message_id: str | None) -> bool:
    if not whatsapp_message_id:
        return False
    result = await db.execute(
        select(WhatsAppMessage.id).where(WhatsAppMessage.whatsapp_message_id == whatsapp_message_id)
    )
    return result.scalar_one_or_none() is not None


async def _get_profile_for_phone_number_id(db: AsyncSession, phone_number_id: str | None) -> Profile | None:
    """Resout le profil proprietaire du numero via une fonction SQL
    SECURITY DEFINER (le webhook n'a pas encore de JWT, donc pas encore de
    profile_id de session -- RLS bloquerait un SELECT direct sur profiles).
    Une fois l'id trouve, on positionne la variable de session pour que
    toutes les ecritures suivantes (client, conversation, commande...)
    passent RLS normalement, isolees a ce tenant."""
    if not phone_number_id:
        return None
    lookup = await db.execute(
        text("SELECT id FROM fn_get_profile_id_by_phone_number_id(:pid)"),
        {"pid": phone_number_id},
    )
    row = lookup.first()
    if not row:
        return None
    await db.execute(text("SELECT set_config('app.current_profile_id', :pid, true)"), {"pid": str(row.id)})
    result = await db.execute(select(Profile).where(Profile.id == row.id))
    return result.scalar_one_or_none()


async def _handle_incoming_message(
    message: dict[str, Any],
    contact_name: str,
    profile: Profile,
    db: AsyncSession,
) -> None:
    phone = message.get("from", "")
    message_type = message.get("type", "text")
    message_id = message.get("id", "")

    customer = await _get_or_create_customer(profile.id, phone, contact_name, db)
    conversation, is_new = await _get_or_create_conversation(profile.id, customer.id, db)
    if is_new:
        await increment_conversation_usage(db, profile.id)

    now = datetime.now(timezone.utc)
    audio_bytes: bytes | None = None
    audio_format = "ogg"
    content = ""

    if message_type == "text":
        content = message.get("text", {}).get("body", "")
    elif message_type == "audio":
        media_id = message.get("audio", {}).get("id")
        content = "[Note vocale]"
        if media_id and profile.whatsapp_token:
            downloaded = await download_whatsapp_media(media_id, profile.whatsapp_token)
            if downloaded:
                audio_bytes, mime_type = downloaded
                audio_format = (mime_type.split("/")[-1].split(";")[0]) if mime_type else "ogg"
        incoming_msg = WhatsAppMessage(
            conversation_id=conversation.id,
            direction="incoming",
            message_type="audio",
            content=content,
            whatsapp_message_id=message_id,
            media_id=media_id,
            media_mime_type=audio_format,
        )
        db.add(incoming_msg)
    elif message_type == "image":
        content = message.get("image", {}).get("caption", "[Image]")
    elif message_type == "button":
        content = message.get("button", {}).get("text", "")
    else:
        content = f"[{message_type}]"

    if message_type != "audio":
        db.add(
            WhatsAppMessage(
                conversation_id=conversation.id,
                direction="incoming",
                message_type=message_type,
                content=content,
                whatsapp_message_id=message_id,
            )
        )

    conversation.message_count = (conversation.message_count or 0) + 1
    conversation.last_message_at = now
    conversation.last_inbound_at = now
    await db.flush()

    reply_text = await run_agent_turn(
        db,
        profile,
        customer,
        conversation,
        user_text=content if message_type != "audio" else None,
        audio_bytes=audio_bytes,
        audio_format=audio_format,
    )

    if reply_text and profile.whatsapp_token and profile.whatsapp_phone_number_id:
        send_result = await send_whatsapp_message(
            phone, reply_text, token=profile.whatsapp_token, phone_number_id=profile.whatsapp_phone_number_id
        )
        db.add(
            WhatsAppMessage(
                conversation_id=conversation.id,
                direction="outgoing",
                message_type="text",
                content=reply_text,
                whatsapp_message_id=send_result.get("message_id"),
                status="sent" if send_result.get("success") else "failed",
                error_message=send_result.get("error"),
            )
        )
        conversation.message_count = (conversation.message_count or 0) + 1
        await db.flush()

    await mark_followups_answered(db, customer, conversation.outcome)
    await maybe_summarize(db, conversation)


async def _handle_status_update(status_data: dict[str, Any], db: AsyncSession) -> None:
    msg_id = status_data.get("id", "")
    new_status = status_data.get("status", "")
    result = await db.execute(
        select(WhatsAppMessage).where(WhatsAppMessage.whatsapp_message_id == msg_id)
    )
    msg = result.scalar_one_or_none()
    if msg:
        msg.status = new_status


async def _get_or_create_customer(
    profile_id: Any, phone: str, name: str, db: AsyncSession
) -> Customer:
    result = await db.execute(
        select(Customer).where(Customer.profile_id == profile_id, Customer.whatsapp_phone == phone)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        customer = Customer(profile_id=profile_id, whatsapp_phone=phone, name=name or None)
        db.add(customer)
        await db.flush()
    elif name and not customer.name:
        customer.name = name
    return customer


async def _get_or_create_conversation(
    profile_id: Any, customer_id: Any, db: AsyncSession
) -> tuple[WhatsAppConversation, bool]:
    result = await db.execute(
        select(WhatsAppConversation)
        .where(WhatsAppConversation.customer_id == customer_id, WhatsAppConversation.is_active.is_(True))
        .order_by(WhatsAppConversation.created_at.desc())
    )
    conversation = result.scalars().first()
    if conversation:
        return conversation, False
    conversation = WhatsAppConversation(profile_id=profile_id, customer_id=customer_id, state="active")
    db.add(conversation)
    await db.flush()
    return conversation, True
