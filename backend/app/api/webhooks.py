import json
import logging
import random
import string
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.config import settings
from app.models.customer import Customer
from app.models.order import Order, OrderItem
from app.models.order_status_history import OrderStatusHistory
from app.models.product import Product
from app.models.profile import Profile
from app.models.whatsapp_conversation import WhatsAppConversation
from app.models.whatsapp_message import WhatsAppMessage
from app.services.whatsapp import send_whatsapp_message

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


@router.post("/whatsapp")
async def receive_whatsapp_message(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    body = await request.json()
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
        await _handle_incoming_message(messages[0], value, profile, db)
    elif statuses:
        await _handle_status_update(statuses[0], db)
    return {"status": "ok"}


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
    value: dict[str, Any],
    profile: Profile,
    db: AsyncSession,
) -> None:
    phone = message.get("from", "")
    message_type = message.get("type", "text")
    message_id = message.get("id", "")
    if message_type == "text":
        content = message.get("text", {}).get("body", "")
    elif message_type == "image":
        content = message.get("image", {}).get("caption", "[Image]")
    elif message_type == "button":
        content = message.get("button", {}).get("text", "")
    else:
        content = f"[{message_type}]"
    contacts = value.get("contacts", [{}])
    contact_name = contacts[0].get("profile", {}).get("name", "") if contacts else ""
    customer = await _get_or_create_customer(profile.id, phone, contact_name, db)
    conversation = await _get_or_create_conversation(profile.id, customer.id, db)
    incoming_msg = WhatsAppMessage(
        conversation_id=conversation.id,
        direction="incoming",
        message_type=message_type,
        content=content,
        whatsapp_message_id=message_id,
    )
    db.add(incoming_msg)
    conversation.message_count = (conversation.message_count or 0) + 1
    conversation.last_message_at = datetime.now(timezone.utc)
    await db.flush()
    await _process_conversation_state(profile, customer, conversation, content, db)


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
) -> WhatsAppConversation:
    result = await db.execute(
        select(WhatsAppConversation)
        .where(WhatsAppConversation.customer_id == customer_id)
        .order_by(WhatsAppConversation.created_at.desc())
    )
    conversation = result.scalars().first()
    if not conversation or conversation.state == "closed" or not conversation.is_active:
        conversation = WhatsAppConversation(profile_id=profile_id, customer_id=customer_id, state="idle")
        db.add(conversation)
        await db.flush()
    return conversation


async def _reply(profile: Profile, phone: str, message: str) -> None:
    if not profile.whatsapp_token or not profile.whatsapp_phone_number_id:
        logger.warning("Profil %s sans token/phone_number_id WhatsApp configure, message non envoye", profile.id)
        return
    await send_whatsapp_message(
        phone, message, token=profile.whatsapp_token, phone_number_id=profile.whatsapp_phone_number_id
    )


async def _process_conversation_state(
    profile: Profile,
    customer: Customer,
    conversation: WhatsAppConversation,
    content: str,
    db: AsyncSession,
) -> None:
    state = conversation.state
    text = content.strip().lower()
    if state == "idle":
        await _handle_idle_state(profile, customer, conversation, text, db)
    elif state == "awaiting_product_choice":
        await _handle_product_choice(profile, customer, conversation, text, db)
    elif state == "awaiting_quantity":
        await _handle_quantity(profile, customer, conversation, text, db)
    elif state == "awaiting_delivery_address":
        await _handle_delivery_address(profile, customer, conversation, content, db)
    elif state == "awaiting_confirmation":
        await _handle_confirmation(profile, customer, conversation, text, db)
    elif state == "order_active":
        await _handle_order_active(profile, customer, conversation, text, db)


async def _handle_idle_state(
    profile: Profile,
    customer: Customer,
    conversation: WhatsAppConversation,
    text: str,
    db: AsyncSession,
) -> None:
    greetings = ["bonjour", "salut", "hello", "bonsoir", "hey", "coucou"]
    menu_keywords = ["menu", "commander", "commande", "catalogue", "produits"]
    if any(g in text for g in greetings):
        await _reply(
            profile,
            customer.whatsapp_phone,
            "Bonjour {} ! \n\n"
            "Bienvenue sur *{}* !\n\n"
            "Tapez *menu* pour voir nos produits\n"
            "Tapez *commande* pour passer une commande\n"
            "Tapez *aide* pour obtenir de l'aide".format(customer.name or "", profile.shop_name),
        )
    elif any(k in text for k in menu_keywords):
        result = await db.execute(
            select(Product)
            .where(Product.profile_id == profile.id, Product.is_available == True)  # noqa: E712
            .order_by(Product.name)
        )
        products = result.scalars().all()
        if products:
            menu_text = "*Notre Carte*\n\n"
            for i, p in enumerate(products, 1):
                menu_text += "*{}. {}*\n".format(i, p.name)
                menu_text += "   {:,.0f} FCFA".format(p.price)
                if p.description:
                    menu_text += "\n   {}".format(p.description[:60])
                menu_text += "\n\n"
            menu_text += "Tapez le *numéro* du produit pour commander"
            await _reply(profile, customer.whatsapp_phone, menu_text)
            conversation.state = "awaiting_product_choice"
        else:
            await _reply(profile, customer.whatsapp_phone, "Desole, aucun produit disponible pour le moment.")
    elif text in ("aide", "help"):
        await _reply(
            profile,
            customer.whatsapp_phone,
            "*Aide*\n\n"
            "- *menu* : Voir le catalogue\n"
            "- *commande* : Passer une commande\n"
            "- *suivi* : Suivre votre commande\n"
            "- *annuler* : Annuler la commande en cours\n\n"
            "Besoin d'aide ? Ecrivez-nous !",
        )
    elif text == "suivi":
        result = await db.execute(
            select(Order)
            .where(Order.profile_id == profile.id, Order.customer_id == customer.id)
            .order_by(Order.created_at.desc())
        )
        last_order = result.scalars().first()
        if last_order:
            status_map = {
                "pending": "En attente",
                "confirmed": "Confirmee",
                "delivering": "En livraison",
                "delivered": "Livree",
                "cancelled": "Annulee",
            }
            status_text = status_map.get(last_order.status, last_order.status)
            await _reply(
                profile,
                customer.whatsapp_phone,
                "Commande *{}*\nStatut : {}\nTotal : {:,.0f} FCFA".format(
                    last_order.order_number, status_text, last_order.total_amount
                ),
            )
        else:
            await _reply(profile, customer.whatsapp_phone, "Vous n'avez aucune commande en cours.")
    else:
        await _reply(profile, customer.whatsapp_phone, "Je n'ai pas compris. Tapez *menu* pour voir nos produits.")


async def _handle_product_choice(
    profile: Profile,
    customer: Customer,
    conversation: WhatsAppConversation,
    text: str,
    db: AsyncSession,
) -> None:
    if text == "annuler":
        conversation.state = "idle"
        await _reply(profile, customer.whatsapp_phone, "Commande annulee. Tapez *menu* pour recommencer.")
        return
    if text.isdigit():
        result = await db.execute(
            select(Product)
            .where(Product.profile_id == profile.id, Product.is_available == True)  # noqa: E712
            .order_by(Product.name)
        )
        products = result.scalars().all()
        idx = int(text) - 1
        if 0 <= idx < len(products):
            product = products[idx]
            conversation.context = {
                "product_id": str(product.id),
                "product_name": product.name,
                "unit_price": float(product.price),
            }
            conversation.state = "awaiting_quantity"
            await _reply(
                profile,
                customer.whatsapp_phone,
                "*{}*\nPrix : {:,.0f} FCFA\n\n"
                "Combien en souhaitez-vous ?\nTapez un *nombre*.".format(product.name, product.price),
            )
        else:
            await _reply(profile, customer.whatsapp_phone, "Numero invalide. Tapez le bon numero.")
    else:
        await _reply(profile, customer.whatsapp_phone, "Veuillez taper le numero du produit.")


async def _handle_quantity(
    profile: Profile,
    customer: Customer,
    conversation: WhatsAppConversation,
    text: str,
    db: AsyncSession,
) -> None:
    if text == "annuler":
        conversation.state = "idle"
        conversation.context = {}
        await _reply(profile, customer.whatsapp_phone, "Commande annulee. Tapez *menu* pour recommencer.")
        return
    if text.isdigit() and int(text) > 0:
        ctx = dict(conversation.context or {})
        ctx["quantity"] = int(text)
        ctx["subtotal"] = ctx.get("unit_price", 0) * int(text)
        conversation.context = ctx
        conversation.state = "awaiting_delivery_address"
        await _reply(
            profile,
            customer.whatsapp_phone,
            "*{}* x {} = {:,.0f} FCFA\n\n"
            "Ou voulez-vous etre livré ?\n"
            "Envoyez votre *adresse complete* (quartier, ville).".format(
                ctx.get("product_name", ""), int(text), ctx.get("subtotal", 0)
            ),
        )
    else:
        await _reply(profile, customer.whatsapp_phone, "Veuillez taper un nombre valide.")


async def _handle_delivery_address(
    profile: Profile,
    customer: Customer,
    conversation: WhatsAppConversation,
    content: str,
    db: AsyncSession,
) -> None:
    ctx = dict(conversation.context or {})
    ctx["delivery_address"] = content.strip()
    conversation.context = ctx
    conversation.state = "awaiting_confirmation"
    await _reply(
        profile,
        customer.whatsapp_phone,
        "*Resume de votre commande*\n\n"
        "Produit : *{}*\n"
        "Quantite : *{}*\n"
        "Sous-total : *{:,.0f} FCFA*\n"
        "Adresse : *{}*\n\n"
        "Tapez *oui* pour confirmer\n"
        "Tapez *non* pour annuler".format(
            ctx.get("product_name", ""),
            ctx.get("quantity", 0),
            ctx.get("subtotal", 0),
            ctx.get("delivery_address", ""),
        ),
    )


async def _handle_confirmation(
    profile: Profile,
    customer: Customer,
    conversation: WhatsAppConversation,
    text: str,
    db: AsyncSession,
) -> None:
    if text in ("oui", "yes", "ok", "confirmer", "confirme"):
        ctx = dict(conversation.context or {})
        now = datetime.now(timezone.utc)
        date_str = now.strftime("%Y%m%d")
        rand_suffix = "".join(random.choices(string.digits, k=4))
        order_number = "KOZ-{}-{}".format(date_str, rand_suffix)
        subtotal = ctx.get("subtotal", 0)
        order = Order(
            profile_id=profile.id,
            customer_id=customer.id,
            order_number=order_number,
            status="pending",
            subtotal=subtotal,
            total_amount=subtotal,
            delivery_address=ctx.get("delivery_address"),
            delivery_city=None,
        )
        db.add(order)
        await db.flush()
        item = OrderItem(
            order_id=order.id,
            product_id=ctx.get("product_id"),
            product_name=ctx.get("product_name", ""),
            quantity=ctx.get("quantity", 1),
            unit_price=ctx.get("unit_price", 0),
            subtotal=subtotal,
        )
        db.add(item)
        history = OrderStatusHistory(
            order_id=order.id,
            old_status=None,
            new_status="pending",
            changed_by="bot",
            note="Commande creee via WhatsApp",
        )
        db.add(history)
        customer.total_orders = (customer.total_orders or 0) + 1
        customer.total_spent = (customer.total_spent or 0) + subtotal
        customer.last_order_at = now
        conversation.state = "order_active"
        conversation.context = {"active_order_id": str(order.id)}
        await _reply(
            profile,
            customer.whatsapp_phone,
            "Commande *{}* confirmee !\n\n"
            "Total : *{:,.0f} FCFA*\n"
            "Adresse : *{}*\n\n"
            "Nous vous tenons informe de l'avancement. Merci !".format(
                order_number, subtotal, ctx.get("delivery_address", "")
            ),
        )
    elif text in ("non", "no", "annuler", "cancel"):
        conversation.state = "idle"
        conversation.context = {}
        await _reply(profile, customer.whatsapp_phone, "Commande annulee. Tapez *menu* pour recommencer.")
    else:
        await _reply(profile, customer.whatsapp_phone, "Tapez *oui* pour confirmer ou *non* pour annuler.")


async def _handle_order_active(
    profile: Profile,
    customer: Customer,
    conversation: WhatsAppConversation,
    text: str,
    db: AsyncSession,
) -> None:
    keywords_menu = ["menu", "commander", "commande", "nouvelle commande"]
    if any(k in text for k in keywords_menu):
        conversation.state = "idle"
        await _handle_idle_state(profile, customer, conversation, "menu", db)
    elif text == "suivi":
        await _handle_idle_state(profile, customer, conversation, "suivi", db)
    else:
        await _reply(
            profile,
            customer.whatsapp_phone,
            "Votre commande est en cours.\n"
            "Tapez *menu* pour une nouvelle commande\n"
            "Tapez *suivi* pour suivre votre commande.",
        )
