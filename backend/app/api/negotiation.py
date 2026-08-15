from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_profile, get_db_session
from app.models.negotiation_rule import NegotiationRule
from app.models.product import Product
from app.models.profile import Profile
from app.schemas.negotiation import NegotiationRuleRead, NegotiationRuleUpsert

router = APIRouter(prefix="/api/negotiation-rules", tags=["negotiation"])


@router.get("/", response_model=list[NegotiationRuleRead])
async def list_rules(
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    result = await db.execute(
        select(NegotiationRule).where(NegotiationRule.profile_id == current_profile.id)
    )
    return [NegotiationRuleRead.model_validate(r) for r in result.scalars().all()]


@router.put("/{product_id}", response_model=NegotiationRuleRead)
async def upsert_rule(
    product_id: UUID,
    body: NegotiationRuleUpsert,
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    product_result = await db.execute(
        select(Product).where(Product.id == product_id, Product.profile_id == current_profile.id)
    )
    product = product_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produit non trouve")

    if body.floor_price > float(product.price):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Le prix plancher ne peut pas dépasser le prix catalogue",
        )

    rule_result = await db.execute(
        select(NegotiationRule).where(NegotiationRule.product_id == product_id)
    )
    rule = rule_result.scalar_one_or_none()
    if rule:
        rule.is_negotiable = body.is_negotiable
        rule.floor_price = body.floor_price
        rule.max_discount_pct = body.max_discount_pct
    else:
        rule = NegotiationRule(
            profile_id=current_profile.id,
            product_id=product_id,
            is_negotiable=body.is_negotiable,
            floor_price=body.floor_price,
            max_discount_pct=body.max_discount_pct,
        )
        db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return NegotiationRuleRead.model_validate(rule)
