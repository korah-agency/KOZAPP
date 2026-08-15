import uuid
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_profile, get_db_session
from app.models.product import Product
from app.models.profile import Profile
from app.schemas.product import ProductCreate, ProductRead, ProductUpdate
from app.utils.slug import slugify

router = APIRouter(prefix="/api/products", tags=["products"])

UPLOAD_ROOT = Path(__file__).resolve().parent.parent.parent / "uploads" / "products"
ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 Mo


@router.get("/", response_model=list[ProductRead])
async def list_products(
    category_id: UUID | None = Query(None),
    is_available: bool | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    query = select(Product).where(Product.profile_id == current_profile.id)
    if category_id:
        query = query.where(Product.category_id == category_id)
    if is_available is not None:
        query = query.where(Product.is_available == is_available)
    query = query.order_by(Product.name)
    result = await db.execute(query)
    products = result.scalars().all()
    return [ProductRead.model_validate(p) for p in products]


@router.get("/{product_id}", response_model=ProductRead)
async def get_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.profile_id == current_profile.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produit non trouve")
    return ProductRead.model_validate(product)


@router.post("/", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
async def create_product(
    body: ProductCreate,
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    data = body.model_dump()
    slug = data.pop("slug", None) or slugify(data["name"])
    base_slug = slug
    suffix = 1
    while True:
        existing = await db.execute(
            select(Product).where(Product.profile_id == current_profile.id, Product.slug == slug)
        )
        if not existing.scalar_one_or_none():
            break
        suffix += 1
        slug = f"{base_slug}-{suffix}"

    product = Product(**data, slug=slug, profile_id=current_profile.id)
    db.add(product)
    await db.flush()
    await db.refresh(product)
    return ProductRead.model_validate(product)


@router.patch("/{product_id}", response_model=ProductRead)
async def update_product(
    product_id: UUID,
    body: ProductUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.profile_id == current_profile.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produit non trouve")
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    await db.flush()
    await db.refresh(product)
    return ProductRead.model_validate(product)


@router.post("/{product_id}/image", response_model=ProductRead)
async def upload_product_image(
    product_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.profile_id == current_profile.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produit non trouve")

    extension = ALLOWED_IMAGE_TYPES.get(file.content_type)
    if not extension:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Formats acceptés : JPEG, PNG, WEBP.",
        )
    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image trop volumineuse (5 Mo maximum).",
        )

    profile_dir = UPLOAD_ROOT / str(current_profile.id)
    profile_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    (profile_dir / filename).write_bytes(contents)

    product.image_url = f"/uploads/products/{current_profile.id}/{filename}"
    await db.flush()
    await db.refresh(product)
    return ProductRead.model_validate(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.profile_id == current_profile.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produit non trouve")
    product.is_available = False
    await db.flush()
