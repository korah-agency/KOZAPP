import random
import string
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderItem
from app.models.order_status_history import OrderStatusHistory


async def generate_order_number(db: AsyncSession) -> str:
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%Y%m%d")
    rand_suffix = "".join(random.choices(string.digits, k=4))
    order_number = "KOZ-{}-{}".format(date_str, rand_suffix)
    result = await db.execute(
        select(Order).where(Order.order_number == order_number)
    )
    while result.scalar_one_or_none():
        rand_suffix = "".join(random.choices(string.digits, k=4))
        order_number = "KOZ-{}-{}".format(date_str, rand_suffix)
        result = await db.execute(
            select(Order).where(Order.order_number == order_number)
        )
    return order_number


async def create_order(
    db: AsyncSession,
    profile_id: uuid.UUID,
    customer_id: uuid.UUID,
    items_data: list[dict],
    delivery_address: str | None = None,
    delivery_city: str | None = None,
    delivery_neighborhood: str | None = None,
    notes: str | None = None,
) -> Order:
    order_number = await generate_order_number(db)
    total = sum(item.get("subtotal", 0) for item in items_data)
    order = Order(
        profile_id=profile_id,
        customer_id=customer_id,
        order_number=order_number,
        status="pending",
        subtotal=total,
        total_amount=total,
        delivery_address=delivery_address,
        delivery_city=delivery_city,
        delivery_neighborhood=delivery_neighborhood,
        notes=notes,
    )
    db.add(order)
    await db.flush()
    for item_data in items_data:
        item = OrderItem(
            order_id=order.id,
            product_id=item_data["product_id"],
            product_name=item_data.get("product_name", ""),
            quantity=item_data["quantity"],
            unit_price=item_data["unit_price"],
            subtotal=item_data["subtotal"],
        )
        db.add(item)
    history = OrderStatusHistory(
        order_id=order.id,
        old_status=None,
        new_status="pending",
        changed_by="system",
        note="Commande creee",
    )
    db.add(history)
    await db.flush()
    return order


async def update_order_status(
    db: AsyncSession,
    order_id: uuid.UUID,
    new_status: str,
    note: str | None = None,
    changed_by: str | None = "admin",
) -> Order | None:
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        return None
    old_status = order.status
    order.status = new_status
    if new_status == "delivered":
        order.delivered_at = datetime.now(timezone.utc)
    history = OrderStatusHistory(
        order_id=order.id,
        old_status=old_status,
        new_status=new_status,
        changed_by=changed_by,
        note=note,
    )
    db.add(history)
    await db.flush()
    return order


async def get_order_summary(db: AsyncSession, order_id: uuid.UUID) -> dict | None:
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        return None
    return {
        "id": str(order.id),
        "order_number": order.order_number,
        "status": order.status,
        "total_amount": float(order.total_amount),
        "items": [
            {
                "product_name": item.product_name,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "subtotal": float(item.subtotal),
            }
            for item in order.items
        ],
    }
