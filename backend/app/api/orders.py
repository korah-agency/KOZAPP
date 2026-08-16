from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_profile, get_db_session
from app.models.order import Order
from app.models.profile import Profile
from app.schemas.order import OrderCreate, OrderListResponse, OrderRead, OrderStatusUpdate
from app.services.order_service import create_order, update_order_status
from app.services.whatsapp import send_whatsapp_message

router = APIRouter(prefix="/api/orders", tags=["orders"])

STATUS_LABELS_FR = {
    "pending": "en attente",
    "confirmed": "validée",
    "delivering": "en cours de livraison",
    "delivered": "livrée",
    "cancelled": "annulée",
}


@router.get("/", response_model=OrderListResponse)
async def list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    order_status: str | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    query = select(Order).where(Order.profile_id == current_profile.id)
    count_query = select(func.count(Order.id)).where(Order.profile_id == current_profile.id)
    if order_status:
        # orders.status est un enum Postgres cote base ; caster en texte
        # evite "l'operateur n'existe pas : order_status = character varying"
        # quand SQLAlchemy lie le parametre en VARCHAR.
        query = query.where(cast(Order.status, String) == order_status)
        count_query = count_query.where(cast(Order.status, String) == order_status)
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    offset = (page - 1) * page_size
    query = query.order_by(Order.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    orders = result.scalars().all()
    return OrderListResponse(
        items=[OrderRead.model_validate(o) for o in orders],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
async def create_new_order(
    body: OrderCreate,
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    from app.models.product import Product

    items_data = []
    for item in body.items:
        result = await db.execute(
            select(Product).where(Product.id == item.product_id, Product.profile_id == current_profile.id)
        )
        product = result.scalar_one_or_none()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Produit {item.product_id} introuvable dans ce catalogue",
            )
        items_data.append({
            "product_id": product.id,
            "product_name": product.name,
            "quantity": item.quantity,
            "unit_price": float(product.price),
            "subtotal": float(product.price) * item.quantity,
        })

    order = await create_order(
        db,
        profile_id=current_profile.id,
        customer_id=body.customer_id,
        items_data=items_data,
        delivery_address=body.delivery_address,
        delivery_city=body.delivery_city,
        delivery_neighborhood=body.delivery_neighborhood,
        notes=body.notes,
    )
    await db.refresh(order, attribute_names=["customer", "items"])
    return OrderRead.model_validate(order)


@router.get("/{order_id}", response_model=OrderRead)
async def get_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.profile_id == current_profile.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commande non trouvee")
    return OrderRead.model_validate(order)


@router.patch("/{order_id}/status", response_model=OrderRead)
async def change_order_status(
    order_id: UUID,
    body: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.profile_id == current_profile.id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commande non trouvee")

    order = await update_order_status(db, order_id, body.status, body.note)
    await db.refresh(order, attribute_names=["customer", "items"])

    if body.notify_customer and current_profile.whatsapp_token and current_profile.whatsapp_phone_number_id:
        label = STATUS_LABELS_FR.get(body.status, body.status)
        await send_whatsapp_message(
            order.customer.whatsapp_phone,
            f"Votre commande {order.order_number} est maintenant *{label}*.",
            token=current_profile.whatsapp_token,
            phone_number_id=current_profile.whatsapp_phone_number_id,
        )

    return OrderRead.model_validate(order)
