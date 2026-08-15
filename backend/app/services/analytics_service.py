import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.followup_send import FollowupSend
from app.models.order import Order, OrderItem
from app.models.profile import Profile
from app.models.whatsapp_conversation import WhatsAppConversation
from app.services.agent.quota import get_quota_usage


async def get_daily_sales(db: AsyncSession, profile_id: uuid.UUID, days: int = 30) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(
            func.date(Order.created_at).label("date"),
            func.count(Order.id).label("order_count"),
            func.coalesce(func.sum(Order.total_amount), 0).label("total_revenue"),
        )
        .where(Order.profile_id == profile_id, Order.created_at >= since)
        .group_by(func.date(Order.created_at))
        .order_by(func.date(Order.created_at))
    )
    rows = result.all()
    return [
        {
            "date": str(row.date),
            "order_count": row.order_count,
            "total_revenue": float(row.total_revenue),
        }
        for row in rows
    ]


async def get_top_products(db: AsyncSession, profile_id: uuid.UUID, limit: int = 10) -> list[dict]:
    result = await db.execute(
        select(
            OrderItem.product_id,
            OrderItem.product_name,
            func.sum(OrderItem.quantity).label("total_quantity"),
            func.sum(OrderItem.subtotal).label("total_revenue"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.profile_id == profile_id)
        .group_by(OrderItem.product_id, OrderItem.product_name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
    )
    rows = result.all()
    return [
        {
            "product_id": str(row.product_id),
            "product_name": row.product_name,
            "total_quantity": row.total_quantity,
            "total_revenue": float(row.total_revenue),
        }
        for row in rows
    ]


async def get_summary(db: AsyncSession, profile: Profile, days: int | None = None) -> dict:
    """Si days est fourni, ne compte que les commandes/clients de cette
    periode (utilise par le filtre "Aujourd'hui / 7 jours / Ce mois-ci" du
    tableau de bord) ; sinon, statistiques sur toute la duree de vie."""
    profile_id = profile.id
    since = datetime.now(timezone.utc) - timedelta(days=days) if days else None

    orders_query = select(
        func.count(Order.id).label("total_orders"),
        func.coalesce(func.sum(Order.total_amount), 0).label("total_revenue"),
    ).where(Order.profile_id == profile_id)
    if since:
        orders_query = orders_query.where(Order.created_at >= since)
    orders_row = (await db.execute(orders_query)).one()

    customers_query = select(func.count(Customer.id)).where(Customer.profile_id == profile_id)
    if since:
        customers_query = customers_query.where(Customer.created_at >= since)
    total_customers = (await db.execute(customers_query)).scalar()

    total_orders = orders_row.total_orders
    total_revenue = float(orders_row.total_revenue)
    avg_order = total_revenue / total_orders if total_orders > 0 else 0.0
    quota = await get_quota_usage(db, profile)
    return {
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "total_customers": total_customers,
        "average_order_value": round(avg_order, 2),
        "quota": quota,
    }


# ------------------------------------------------------------------
# Analytics avancees (socle agent) -- section "Analytics" du tableau de bord
# ------------------------------------------------------------------

async def get_geo_breakdown(db: AsyncSession, profile_id: uuid.UUID, days: int | None = None, limit: int = 8) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=days) if days else None
    query = (
        select(
            func.coalesce(Order.delivery_neighborhood, Order.delivery_city, "Non renseigne").label("neighborhood"),
            func.count(Order.id).label("order_count"),
            func.coalesce(func.sum(Order.total_amount), 0).label("total_revenue"),
        )
        .where(Order.profile_id == profile_id, Order.status != "cancelled")
        .group_by("neighborhood")
        .order_by(func.count(Order.id).desc())
        .limit(limit)
    )
    if since:
        query = query.where(Order.created_at >= since)
    rows = (await db.execute(query)).all()
    return [
        {"neighborhood": r.neighborhood, "order_count": r.order_count, "total_revenue": float(r.total_revenue)}
        for r in rows
    ]


async def get_conversion_stats(db: AsyncSession, profile_id: uuid.UUID, days: int | None = None) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=days) if days else None
    query = select(
        func.count(WhatsAppConversation.id).label("total"),
        func.count(case((WhatsAppConversation.outcome == "commande_conclue", 1))).label("converted"),
        func.count(case((WhatsAppConversation.outcome == "perdue", 1))).label("lost"),
        func.count(case((WhatsAppConversation.outcome.in_(["en_cours", "negociation"]), 1))).label("in_progress"),
        func.count(case((WhatsAppConversation.outcome == "escaladee", 1))).label("escalated"),
    ).where(WhatsAppConversation.profile_id == profile_id)
    if since:
        query = query.where(WhatsAppConversation.created_at >= since)
    row = (await db.execute(query)).one()
    rate = (row.converted / row.total * 100) if row.total > 0 else 0.0
    return {
        "total_conversations": row.total,
        "converted": row.converted,
        "lost": row.lost,
        "in_progress": row.in_progress,
        "escalated": row.escalated,
        "conversion_rate": round(rate, 1),
    }


async def get_peak_hours(db: AsyncSession, profile_id: uuid.UUID, days: int | None = None) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=days) if days else None
    query = (
        select(
            func.extract("hour", Order.created_at).label("hour"),
            func.count(Order.id).label("order_count"),
        )
        .where(Order.profile_id == profile_id, Order.status != "cancelled")
        .group_by("hour")
        .order_by("hour")
    )
    if since:
        query = query.where(Order.created_at >= since)
    rows = (await db.execute(query)).all()
    counts = {int(r.hour): r.order_count for r in rows}
    return [{"hour": h, "order_count": counts.get(h, 0)} for h in range(24)]


async def get_followup_performance(db: AsyncSession, profile_id: uuid.UUID, days: int | None = None) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=days) if days else None
    query = select(
        func.count(FollowupSend.id).label("sent"),
        func.count(case((FollowupSend.result.in_(["repondu", "commande"]), 1))).label("responded"),
        func.count(case((FollowupSend.result == "commande", 1))).label("converted"),
    ).where(FollowupSend.profile_id == profile_id)
    if since:
        query = query.where(FollowupSend.sent_at >= since)
    row = (await db.execute(query)).one()

    # Montant recupere : commandes du client passees dans les 48h suivant une
    # relance marquee "commande" (heuristique raisonnable en l'absence d'un
    # lien direct relance -> commande).
    recovered_query = (
        select(func.coalesce(func.sum(Order.total_amount), 0))
        .select_from(FollowupSend)
        .join(Order, Order.customer_id == FollowupSend.customer_id)
        .where(
            FollowupSend.profile_id == profile_id,
            FollowupSend.result == "commande",
            Order.created_at >= FollowupSend.sent_at,
            Order.created_at <= FollowupSend.sent_at + timedelta(hours=48),
        )
    )
    recovered = (await db.execute(recovered_query)).scalar() or 0

    sent = row.sent or 0
    response_rate = (row.responded / sent * 100) if sent > 0 else 0.0
    conversion_rate = (row.converted / sent * 100) if sent > 0 else 0.0
    return {
        "sent": sent,
        "responded": row.responded,
        "converted": row.converted,
        "recovered_amount": float(recovered),
        "response_rate": round(response_rate, 1),
        "conversion_rate": round(conversion_rate, 1),
    }


async def get_negotiation_impact(db: AsyncSession, profile_id: uuid.UUID, days: int | None = None) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=days) if days else None
    query = select(
        func.count(func.distinct(Order.id)).label("total_orders"),
        func.count(func.distinct(case((OrderItem.list_price > OrderItem.unit_price, Order.id)))).label(
            "negotiated_orders"
        ),
        func.coalesce(func.sum(Order.discount_total), 0).label("total_discount"),
        func.coalesce(
            func.avg(
                case(
                    (
                        OrderItem.list_price > 0,
                        (OrderItem.list_price - OrderItem.unit_price) / OrderItem.list_price * 100,
                    )
                )
            ),
            0,
        ).label("avg_discount_pct"),
    ).select_from(Order).join(OrderItem, OrderItem.order_id == Order.id).where(
        Order.profile_id == profile_id, Order.status != "cancelled"
    )
    if since:
        query = query.where(Order.created_at >= since)
    row = (await db.execute(query)).one()
    total = row.total_orders or 0
    negotiated = row.negotiated_orders or 0
    share = (negotiated / total * 100) if total > 0 else 0.0
    return {
        "negotiated_orders": negotiated,
        "total_orders": total,
        "negotiated_share": round(share, 1),
        "average_discount_pct": round(float(row.avg_discount_pct or 0), 1),
        "total_discount_amount": float(row.total_discount),
    }


async def get_leaking_sales(db: AsyncSession, profile_id: uuid.UUID, stale_hours: int = 24, limit: int = 10) -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=stale_hours)
    query = (
        select(WhatsAppConversation, Customer)
        .join(Customer, Customer.id == WhatsAppConversation.customer_id)
        .where(
            WhatsAppConversation.profile_id == profile_id,
            WhatsAppConversation.outcome.in_(["en_cours", "negociation"]),
            WhatsAppConversation.last_message_at <= cutoff,
        )
        .order_by(WhatsAppConversation.estimated_amount.desc().nullslast())
        .limit(limit)
    )
    rows = (await db.execute(query)).all()

    total_query = select(
        func.count(WhatsAppConversation.id),
        func.coalesce(func.sum(WhatsAppConversation.estimated_amount), 0),
    ).where(
        WhatsAppConversation.profile_id == profile_id,
        WhatsAppConversation.outcome.in_(["en_cours", "negociation"]),
        WhatsAppConversation.last_message_at <= cutoff,
    )
    total_count, total_amount = (await db.execute(total_query)).one()

    return {
        "count": total_count,
        "estimated_amount": float(total_amount),
        "items": [
            {
                "customer_name": customer.name or customer.whatsapp_phone,
                "whatsapp_phone": customer.whatsapp_phone,
                "outcome": conv.outcome,
                "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
                "estimated_amount": float(conv.estimated_amount) if conv.estimated_amount is not None else None,
            }
            for conv, customer in rows
        ],
    }


async def get_customer_segments(db: AsyncSession, profile_id: uuid.UUID, days: int | None = None) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=days) if days else None
    new_query = select(func.count(Customer.id)).where(Customer.profile_id == profile_id)
    if since:
        new_query = new_query.where(Customer.created_at >= since)
    new_customers = (await db.execute(new_query)).scalar() or 0

    returning_query = select(func.count(Customer.id)).where(
        Customer.profile_id == profile_id, Customer.total_orders > 1
    )
    returning_customers = (await db.execute(returning_query)).scalar() or 0

    total_query = select(func.count(Customer.id)).where(Customer.profile_id == profile_id)
    total_customers = (await db.execute(total_query)).scalar() or 0

    rate = (returning_customers / total_customers * 100) if total_customers > 0 else 0.0
    return {
        "new_customers": new_customers,
        "returning_customers": returning_customers,
        "repeat_rate": round(rate, 1),
    }


async def get_insights(db: AsyncSession, profile: Profile, days: int | None = None) -> dict:
    """Agrege les 8 analytics avancees en un seul appel, pour la page
    Analytics du tableau de bord."""
    return {
        "geo_breakdown": await get_geo_breakdown(db, profile.id, days),
        "conversion": await get_conversion_stats(db, profile.id, days),
        "peak_hours": await get_peak_hours(db, profile.id, days),
        "followups": await get_followup_performance(db, profile.id, days),
        "negotiation": await get_negotiation_impact(db, profile.id, days),
        "leaking_sales": await get_leaking_sales(db, profile.id),
        "segments": await get_customer_segments(db, profile.id, days),
        "quota": await get_quota_usage(db, profile),
    }
