import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.order import Order, OrderItem


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


async def get_summary(db: AsyncSession, profile_id: uuid.UUID, days: int | None = None) -> dict:
    """Si days est fourni, ne compte que les commandes/clients de cette
    periode (utilise par le filtre "Aujourd'hui / 7 jours / Ce mois-ci" du
    tableau de bord) ; sinon, statistiques sur toute la duree de vie."""
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
    return {
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "total_customers": total_customers,
        "average_order_value": round(avg_order, 2),
    }
