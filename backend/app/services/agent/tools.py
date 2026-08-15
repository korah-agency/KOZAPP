"""Les outils appelables par l'agent.

Regle de securite non negociable : ``profile_id`` n'est JAMAIS un parametre
de tool-call. Chaque fonction recoit son ``ToolContext``, construit par le
moteur (engine.py) a partir de la session WhatsApp authentifiee -- jamais a
partir d'un argument fourni par le modele. C'est ce qui empeche un client
d'obtenir, par injection de prompt, les donnees d'une autre boutique.

De meme, aucun outil ne fait confiance a un prix propose par le modele sans
le revalider contre le catalogue et les regles de negociation (voir
``creer_commande`` et ``_resolve_negotiation_rule``).
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.customer import Customer
from app.models.delivery_zone import DeliveryZone
from app.models.negotiation_rule import NegotiationRule
from app.models.order import Order, OrderItem
from app.models.order_status_history import OrderStatusHistory
from app.models.product import Product
from app.models.profile import Profile
from app.models.whatsapp_conversation import WhatsAppConversation
from app.services.order_service import generate_order_number


@dataclass
class ToolContext:
    db: AsyncSession
    profile: Profile
    customer: Customer
    conversation: WhatsAppConversation


class ToolError(Exception):
    """Erreur metier a renvoyer au modele comme resultat du tool (pas une
    exception serveur) : ex. produit introuvable, commande deja validee."""


def _money(value: Any) -> float:
    return float(value) if value is not None else 0.0


# ------------------------------------------------------------------
# Catalogue
# ------------------------------------------------------------------

async def chercher_produit(ctx: ToolContext, query: str, limit: int = 8) -> dict:
    result = await ctx.db.execute(
        text(
            "SELECT id, name, description, price, image_url, sold_count, category_name "
            "FROM fn_search_products(:profile_id, :query, :limit)"
        ),
        {"profile_id": str(ctx.profile.id), "query": query, "limit": limit},
    )
    rows = result.mappings().all()
    return {
        "products": [
            {
                "id": str(r["id"]),
                "name": r["name"],
                "description": r["description"],
                "price": _money(r["price"]),
                "category": r["category_name"],
            }
            for r in rows
        ]
    }


async def lister_categories_produits(ctx: ToolContext) -> dict:
    result = await ctx.db.execute(
        select(Category)
        .where(Category.profile_id == ctx.profile.id, Category.is_active.is_(True))
        .order_by(Category.display_order)
    )
    categories = result.scalars().all()
    return {"categories": [{"name": c.name, "slug": c.slug} for c in categories]}


async def verifier_disponibilite(ctx: ToolContext, product_id: str) -> dict:
    product = await _get_product(ctx, product_id)
    if not product:
        raise ToolError("Produit introuvable dans le catalogue de cette boutique.")
    if not product.is_available:
        return {"available": False, "reason": "indisponible"}
    if product.track_stock:
        in_stock = (product.stock_quantity or 0) > 0
        return {
            "available": in_stock,
            "stock_quantity": product.stock_quantity,
            "reason": None if in_stock else "rupture_de_stock",
        }
    return {"available": True, "stock_quantity": None}


async def _get_product(ctx: ToolContext, product_id: str) -> Product | None:
    try:
        pid = uuid.UUID(product_id)
    except (ValueError, AttributeError):
        return None
    result = await ctx.db.execute(
        select(Product).where(Product.id == pid, Product.profile_id == ctx.profile.id)
    )
    return result.scalar_one_or_none()


# ------------------------------------------------------------------
# Negociation
# ------------------------------------------------------------------

async def _resolve_negotiation_rule(ctx: ToolContext, product_id: uuid.UUID) -> NegotiationRule | None:
    """Regle specifique au produit si elle existe, sinon regle par defaut
    de la boutique (product_id IS NULL), sinon aucune (non negociable)."""
    result = await ctx.db.execute(
        select(NegotiationRule).where(
            NegotiationRule.profile_id == ctx.profile.id,
            NegotiationRule.product_id == product_id,
        )
    )
    rule = result.scalar_one_or_none()
    if rule:
        return rule
    result = await ctx.db.execute(
        select(NegotiationRule).where(
            NegotiationRule.profile_id == ctx.profile.id,
            NegotiationRule.product_id.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def verifier_regle_negociation(ctx: ToolContext, product_id: str) -> dict:
    product = await _get_product(ctx, product_id)
    if not product:
        raise ToolError("Produit introuvable dans le catalogue de cette boutique.")
    rule = await _resolve_negotiation_rule(ctx, product.id)
    if not rule or not rule.is_negotiable:
        return {"is_negotiable": False, "list_price": _money(product.price)}
    return {
        "is_negotiable": True,
        "list_price": _money(product.price),
        "floor_price": _money(rule.floor_price),
        "max_discount_pct": _money(rule.max_discount_pct),
    }


async def calculer_offre_remise(ctx: ToolContext, product_id: str, requested_price: float) -> dict:
    """Calcule la meilleure contre-offre possible, strictement dans les
    limites fixees par le commercant. L'agent ne doit jamais accepter ou
    proposer un prix sans etre passe par ici."""
    product = await _get_product(ctx, product_id)
    if not product:
        raise ToolError("Produit introuvable dans le catalogue de cette boutique.")
    list_price = _money(product.price)
    rule = await _resolve_negotiation_rule(ctx, product.id)

    if not rule or not rule.is_negotiable:
        return {
            "decision": "refuse",
            "final_price": list_price,
            "message_hint": "Ce produit est a prix fixe, non negociable.",
        }

    floor_price = _money(rule.floor_price)
    min_allowed = max(floor_price, list_price * (1 - _money(rule.max_discount_pct) / 100))

    if requested_price >= min_allowed:
        return {
            "decision": "accepte",
            "final_price": round(requested_price, 2),
            "message_hint": "Le prix demande est dans les limites autorisees.",
        }

    # Contre-offre : a mi-chemin entre le prix demande et le minimum autorise,
    # jamais en dessous du minimum.
    counter = round(max(min_allowed, (requested_price + min_allowed) / 2), 2)
    return {
        "decision": "contre_offre",
        "final_price": counter,
        "floor_price": floor_price,
        "message_hint": "Le prix demande est trop bas ; voici la meilleure contre-proposition possible.",
    }


# ------------------------------------------------------------------
# Commandes
# ------------------------------------------------------------------

async def estimer_frais_livraison(ctx: ToolContext, neighborhood: str, order_amount: float | None = None) -> dict:
    result = await ctx.db.execute(
        select(DeliveryZone).where(
            DeliveryZone.profile_id == ctx.profile.id,
            DeliveryZone.is_active.is_(True),
            DeliveryZone.name.ilike(f"%{neighborhood}%"),
        )
    )
    zone = result.scalars().first()
    if not zone:
        return {"zone_matched": False, "fee": None}
    fee = _money(zone.fee)
    if zone.free_above_amount is not None and order_amount is not None and order_amount >= _money(zone.free_above_amount):
        fee = 0.0
    return {"zone_matched": True, "zone_name": zone.name, "fee": fee}


async def creer_commande(
    ctx: ToolContext,
    items: list[dict],
    delivery_address: str | None = None,
    delivery_neighborhood: str | None = None,
    delivery_city: str | None = None,
    notes: str | None = None,
) -> dict:
    if not items:
        raise ToolError("Aucun article fourni pour la commande.")

    order_items: list[OrderItem] = []
    subtotal = 0.0
    discount_total = 0.0

    for raw_item in items:
        product = await _get_product(ctx, str(raw_item.get("product_id", "")))
        if not product or not product.is_available:
            raise ToolError(f"Produit indisponible : {raw_item.get('product_id')}")
        quantity = int(raw_item.get("quantity", 1))
        if quantity <= 0:
            raise ToolError("La quantite doit etre superieure a zero.")

        list_price = _money(product.price)
        requested_price = raw_item.get("unit_price")
        unit_price = list_price
        if requested_price is not None and float(requested_price) != list_price:
            # Prix negocie : on ne fait JAMAIS confiance au chiffre propose par
            # le modele -- on le revalide contre le plancher reel, meme si
            # calculer_offre_remise a deja ete appele plus tot dans l'echange.
            rule = await _resolve_negotiation_rule(ctx, product.id)
            floor_price = _money(rule.floor_price) if rule and rule.is_negotiable else list_price
            unit_price = max(float(requested_price), floor_price)
            if unit_price > list_price:
                unit_price = list_price

        item_subtotal = round(unit_price * quantity, 2)
        subtotal += item_subtotal
        discount_total += round((list_price - unit_price) * quantity, 2)
        order_items.append(
            OrderItem(
                product_id=product.id,
                product_name=product.name,
                quantity=quantity,
                unit_price=unit_price,
                list_price=list_price,
                subtotal=item_subtotal,
            )
        )

    delivery_fee = 0.0
    if delivery_neighborhood:
        estimate = await estimer_frais_livraison(ctx, delivery_neighborhood, subtotal)
        delivery_fee = _money(estimate.get("fee")) if estimate.get("zone_matched") else 0.0

    total_amount = round(subtotal + delivery_fee, 2)
    order = Order(
        profile_id=ctx.profile.id,
        customer_id=ctx.customer.id,
        order_number=await generate_order_number(ctx.db),
        status="pending",
        subtotal=round(subtotal, 2),
        delivery_fee=delivery_fee,
        discount_total=round(discount_total, 2),
        total_amount=total_amount,
        source="agent",
        delivery_address=delivery_address,
        delivery_city=delivery_city,
        delivery_neighborhood=delivery_neighborhood,
        notes=notes,
    )
    ctx.db.add(order)
    await ctx.db.flush()
    for item in order_items:
        item.order_id = order.id
        ctx.db.add(item)
    ctx.db.add(
        OrderStatusHistory(order_id=order.id, old_status=None, new_status="pending", changed_by="agent")
    )

    ctx.customer.total_orders = (ctx.customer.total_orders or 0) + 1
    ctx.customer.total_spent = _money(ctx.customer.total_spent) + total_amount
    ctx.customer.last_order_at = datetime.now(timezone.utc)

    ctx.conversation.outcome = "commande_conclue"
    ctx.conversation.estimated_amount = total_amount

    await ctx.db.flush()
    return {
        "order_number": order.order_number,
        "subtotal": order.subtotal,
        "delivery_fee": order.delivery_fee,
        "discount_total": order.discount_total,
        "total_amount": order.total_amount,
    }


async def modifier_commande(
    ctx: ToolContext,
    order_number: str,
    action: str,
    product_id: str | None = None,
    quantity: int | None = None,
) -> dict:
    result = await ctx.db.execute(
        select(Order).where(Order.order_number == order_number, Order.profile_id == ctx.profile.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise ToolError("Commande introuvable.")
    if order.status != "pending":
        raise ToolError("Cette commande a deja ete validee par le commercant, elle ne peut plus etre modifiee ici.")

    if action == "cancel":
        order.status = "cancelled"
        ctx.db.add(
            OrderStatusHistory(order_id=order.id, old_status="pending", new_status="cancelled", changed_by="agent")
        )
        await ctx.db.flush()
        return {"order_number": order.order_number, "status": "cancelled"}

    if action == "update_quantity":
        if not product_id or quantity is None:
            raise ToolError("product_id et quantity sont requis pour update_quantity.")
        item = next((i for i in order.items if str(i.product_id) == product_id), None)
        if not item:
            raise ToolError("Cet article ne fait pas partie de la commande.")
        if quantity <= 0:
            order.items.remove(item)
            await ctx.db.delete(item)
        else:
            item.quantity = quantity
            item.subtotal = round(item.unit_price * quantity, 2)
    elif action == "remove_item":
        if not product_id:
            raise ToolError("product_id est requis pour remove_item.")
        item = next((i for i in order.items if str(i.product_id) == product_id), None)
        if item:
            order.items.remove(item)
            await ctx.db.delete(item)
    elif action == "add_item":
        if not product_id or not quantity:
            raise ToolError("product_id et quantity sont requis pour add_item.")
        product = await _get_product(ctx, product_id)
        if not product or not product.is_available:
            raise ToolError("Produit indisponible.")
        list_price = _money(product.price)
        ctx.db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                product_name=product.name,
                quantity=quantity,
                unit_price=list_price,
                list_price=list_price,
                subtotal=round(list_price * quantity, 2),
            )
        )
    else:
        raise ToolError(f"Action inconnue : {action}")

    await ctx.db.flush()
    await ctx.db.refresh(order)
    new_subtotal = round(sum(_money(i.subtotal) for i in order.items), 2)
    order.subtotal = new_subtotal
    order.total_amount = round(new_subtotal + _money(order.delivery_fee), 2)
    await ctx.db.flush()
    return {
        "order_number": order.order_number,
        "subtotal": order.subtotal,
        "total_amount": order.total_amount,
        "items": [{"product_name": i.product_name, "quantity": i.quantity} for i in order.items],
    }


_STATUS_LABELS = {
    "pending": "en attente",
    "confirmed": "validee",
    "delivering": "en livraison",
    "delivered": "livree",
    "cancelled": "annulee",
}


async def consulter_statut_commande(ctx: ToolContext, order_number: str | None = None) -> dict:
    query = select(Order).where(Order.profile_id == ctx.profile.id, Order.customer_id == ctx.customer.id)
    if order_number:
        query = query.where(Order.order_number == order_number)
    query = query.order_by(Order.created_at.desc())
    result = await ctx.db.execute(query)
    order = result.scalars().first()
    if not order:
        raise ToolError("Aucune commande trouvee pour ce client.")
    return {
        "order_number": order.order_number,
        "status": order.status,
        "status_label": _STATUS_LABELS.get(order.status, order.status),
        "total_amount": _money(order.total_amount),
        "created_at": order.created_at.isoformat(),
    }


async def lister_commandes_client(ctx: ToolContext, limit: int = 5) -> dict:
    result = await ctx.db.execute(
        select(Order)
        .where(Order.profile_id == ctx.profile.id, Order.customer_id == ctx.customer.id)
        .order_by(Order.created_at.desc())
        .limit(limit)
    )
    orders = result.scalars().all()
    return {
        "orders": [
            {
                "order_number": o.order_number,
                "status": o.status,
                "status_label": _STATUS_LABELS.get(o.status, o.status),
                "total_amount": _money(o.total_amount),
                "created_at": o.created_at.isoformat(),
            }
            for o in orders
        ]
    }


# ------------------------------------------------------------------
# Boutique
# ------------------------------------------------------------------

async def obtenir_infos_boutique(ctx: ToolContext) -> dict:
    p = ctx.profile
    return {
        "shop_name": p.shop_name,
        "description": p.shop_description,
        "address": p.address,
        "city": p.city,
        "delivery_zones": p.delivery_zones,
        "hours": p.hours,
        "extra_info": p.agent_info,
    }


_WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


async def verifier_ouverture(ctx: ToolContext) -> dict:
    hours = ctx.profile.opening_hours
    if not hours:
        return {
            "determinable": False,
            "hours_text": ctx.profile.hours,
            "hint": "Horaires non structures : se referer au texte des horaires pour repondre.",
        }
    now = datetime.now(timezone.utc)
    day_key = _WEEKDAY_KEYS[now.weekday()]
    ranges = hours.get(day_key) or []
    now_hm = now.strftime("%H:%M")
    is_open = any(start <= now_hm <= end for start, end in ranges)
    return {"determinable": True, "is_open": is_open, "today_ranges": ranges}


# ------------------------------------------------------------------
# Client
# ------------------------------------------------------------------

async def obtenir_historique_client(ctx: ToolContext) -> dict:
    c = ctx.customer
    return {
        "is_known": (c.total_orders or 0) > 0,
        "name": c.name,
        "neighborhood": c.neighborhood,
        "total_orders": c.total_orders or 0,
        "total_spent": _money(c.total_spent),
        "last_order_at": c.last_order_at.isoformat() if c.last_order_at else None,
        "preferences": c.preferences or {},
    }


async def enregistrer_infos_client(
    ctx: ToolContext,
    name: str | None = None,
    city: str | None = None,
    neighborhood: str | None = None,
    address: str | None = None,
    preference_note: str | None = None,
) -> dict:
    c = ctx.customer
    if name:
        c.name = name
    if city:
        c.city = city
    if neighborhood:
        c.neighborhood = neighborhood
    if address:
        c.address = address
    if preference_note:
        prefs = dict(c.preferences or {})
        notes = list(prefs.get("notes", []))
        notes.append(preference_note)
        prefs["notes"] = notes[-10:]
        c.preferences = prefs
    await ctx.db.flush()
    return {"saved": True}


_VALID_OUTCOMES = {"en_cours", "negociation", "commande_conclue", "perdue", "escaladee"}


async def mettre_a_jour_bilan_conversation(
    ctx: ToolContext, outcome: str, estimated_amount: float | None = None
) -> dict:
    if outcome not in _VALID_OUTCOMES:
        raise ToolError(f"Bilan inconnu : {outcome}")
    ctx.conversation.outcome = outcome
    if estimated_amount is not None:
        ctx.conversation.estimated_amount = estimated_amount
    await ctx.db.flush()
    return {"saved": True}


# ------------------------------------------------------------------
# Controle
# ------------------------------------------------------------------

async def escalader_vers_commercant(ctx: ToolContext, reason: str) -> dict:
    ctx.conversation.needs_human = True
    ctx.conversation.outcome = "escaladee"
    await ctx.db.flush()
    # NOTE : aucun canal de notification push/email n'existe encore cote
    # commercant (lot 6 de l'audit) -- l'escalade est pour l'instant visible
    # via needs_human dans le tableau de bord uniquement.
    return {"escalated": True, "reason": reason}


# ------------------------------------------------------------------
# Schemas JSON (format OpenAI/OpenRouter) + table de dispatch
# ------------------------------------------------------------------

def _schema(name: str, description: str, properties: dict, required: list[str]) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {"type": "object", "properties": properties, "required": required},
        },
    }


TOOL_SCHEMAS: list[dict] = [
    _schema(
        "chercher_produit",
        "Cherche un ou plusieurs produits du catalogue par nom ou description approximative. "
        "A utiliser des qu'un client demande un prix, une dispo ou des details sur un article.",
        {"query": {"type": "string"}, "limit": {"type": "integer", "default": 8}},
        ["query"],
    ),
    _schema(
        "lister_categories_produits",
        "Renvoie les grandes categories du catalogue (utile quand le client demande 'qu'est-ce que vous avez ?').",
        {},
        [],
    ),
    _schema(
        "verifier_disponibilite",
        "Confirme si un produit precis est en stock au moment exact de la question.",
        {"product_id": {"type": "string"}},
        ["product_id"],
    ),
    _schema(
        "verifier_regle_negociation",
        "Renvoie le prix plancher, la remise max et si le produit est negociable. "
        "TOUJOURS appeler avant d'accepter ou de refuser une remise.",
        {"product_id": {"type": "string"}},
        ["product_id"],
    ),
    _schema(
        "calculer_offre_remise",
        "Calcule la meilleure contre-offre possible face a un prix demande par le client, "
        "en restant dans les limites du commercant. Ne jamais proposer un prix sans passer par ici.",
        {"product_id": {"type": "string"}, "requested_price": {"type": "number"}},
        ["product_id", "requested_price"],
    ),
    _schema(
        "creer_commande",
        "Enregistre la commande une fois que le client a confirme son achat.",
        {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "product_id": {"type": "string"},
                        "quantity": {"type": "integer"},
                        "unit_price": {
                            "type": "number",
                            "description": "Prix negocie si different du prix catalogue ; sinon omettre.",
                        },
                    },
                    "required": ["product_id", "quantity"],
                },
            },
            "delivery_address": {"type": "string"},
            "delivery_neighborhood": {"type": "string"},
            "delivery_city": {"type": "string"},
            "notes": {"type": "string"},
        },
        ["items"],
    ),
    _schema(
        "modifier_commande",
        "Ajuste une commande non encore validee par le commercant (ajouter/retirer un article, "
        "changer une quantite, annuler).",
        {
            "order_number": {"type": "string"},
            "action": {"type": "string", "enum": ["add_item", "update_quantity", "remove_item", "cancel"]},
            "product_id": {"type": "string"},
            "quantity": {"type": "integer"},
        },
        ["order_number", "action"],
    ),
    _schema(
        "consulter_statut_commande",
        "Renvoie le statut d'une commande du client (la plus recente si order_number omis).",
        {"order_number": {"type": "string"}},
        [],
    ),
    _schema(
        "lister_commandes_client",
        "Liste les commandes recentes de ce client.",
        {"limit": {"type": "integer", "default": 5}},
        [],
    ),
    _schema(
        "obtenir_infos_boutique",
        "Renvoie les horaires, la zone de livraison, l'adresse et les infos pratiques de la boutique.",
        {},
        [],
    ),
    _schema(
        "verifier_ouverture",
        "Determine si la boutique est ouverte a l'instant present.",
        {},
        [],
    ),
    _schema(
        "estimer_frais_livraison",
        "Calcule les frais de livraison a partir du quartier indique par le client.",
        {"neighborhood": {"type": "string"}, "order_amount": {"type": "number"}},
        ["neighborhood"],
    ),
    _schema(
        "obtenir_historique_client",
        "Indique si ce client est deja connu (achats precedents, preferences) pour personnaliser la reponse.",
        {},
        [],
    ),
    _schema(
        "enregistrer_infos_client",
        "Enregistre les informations que le client vient de donner (nom, quartier, adresse, preference).",
        {
            "name": {"type": "string"},
            "city": {"type": "string"},
            "neighborhood": {"type": "string"},
            "address": {"type": "string"},
            "preference_note": {"type": "string"},
        },
        [],
    ),
    _schema(
        "mettre_a_jour_bilan_conversation",
        "Met a jour le bilan de la conversation visible par le commercant.",
        {
            "outcome": {
                "type": "string",
                "enum": list(_VALID_OUTCOMES),
            },
            "estimated_amount": {"type": "number"},
        },
        ["outcome"],
    ),
    _schema(
        "escalader_vers_commercant",
        "Marque la conversation comme necessitant l'intervention humaine du commercant "
        "(reclamation, situation ambigue, demande hors cadre).",
        {"reason": {"type": "string"}},
        ["reason"],
    ),
]

TOOL_FUNCTIONS = {
    "chercher_produit": chercher_produit,
    "lister_categories_produits": lister_categories_produits,
    "verifier_disponibilite": verifier_disponibilite,
    "verifier_regle_negociation": verifier_regle_negociation,
    "calculer_offre_remise": calculer_offre_remise,
    "creer_commande": creer_commande,
    "modifier_commande": modifier_commande,
    "consulter_statut_commande": consulter_statut_commande,
    "lister_commandes_client": lister_commandes_client,
    "obtenir_infos_boutique": obtenir_infos_boutique,
    "verifier_ouverture": verifier_ouverture,
    "estimer_frais_livraison": estimer_frais_livraison,
    "obtenir_historique_client": obtenir_historique_client,
    "enregistrer_infos_client": enregistrer_infos_client,
    "mettre_a_jour_bilan_conversation": mettre_a_jour_bilan_conversation,
    "escalader_vers_commercant": escalader_vers_commercant,
}
