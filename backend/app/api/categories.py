from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_profile, get_db_session
from app.models.category import Category
from app.models.profile import Profile
from app.schemas.category import CategoryCreate, CategoryRead
from app.utils.slug import slugify

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("/", response_model=list[CategoryRead])
async def list_categories(
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    result = await db.execute(
        select(Category)
        .where(Category.profile_id == current_profile.id, Category.is_active == True)  # noqa: E712
        .order_by(Category.display_order, Category.name)
    )
    return [CategoryRead.model_validate(c) for c in result.scalars().all()]


@router.post("/", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryCreate,
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    slug = body.slug or slugify(body.name)
    category = Category(
        profile_id=current_profile.id,
        name=body.name,
        slug=slug,
        display_order=body.display_order,
        is_active=body.is_active,
    )
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return CategoryRead.model_validate(category)
