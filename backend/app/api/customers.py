from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_profile, get_db_session
from app.models.customer import Customer
from app.models.profile import Profile
from app.schemas.customer import CustomerRead, CustomerUpdate

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("/", response_model=list[CustomerRead])
async def list_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    query = select(Customer).where(Customer.profile_id == current_profile.id)
    if search:
        pattern = "%{}%".format(search)
        query = query.where(
            or_(
                Customer.name.ilike(pattern),
                Customer.whatsapp_phone.ilike(pattern),
            )
        )
    query = query.order_by(Customer.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    customers = result.scalars().all()
    return [CustomerRead.model_validate(c) for c in customers]


@router.get("/{customer_id}", response_model=CustomerRead)
async def get_customer(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.profile_id == current_profile.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client non trouve")
    return CustomerRead.model_validate(customer)


@router.patch("/{customer_id}", response_model=CustomerRead)
async def update_customer(
    customer_id: UUID,
    body: CustomerUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.profile_id == current_profile.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client non trouve")
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customer, field, value)
    await db.flush()
    await db.refresh(customer)
    return CustomerRead.model_validate(customer)
