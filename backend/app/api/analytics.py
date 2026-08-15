from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_profile, get_db_session
from app.models.profile import Profile
from app.schemas.analytics import AnalyticsInsights, AnalyticsSummary, DailySales, TopProduct
from app.services.analytics_service import get_daily_sales, get_insights, get_summary, get_top_products

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/daily-sales", response_model=list[DailySales])
async def daily_sales(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    data = await get_daily_sales(db, current_profile.id, days)
    return [DailySales(**d) for d in data]


@router.get("/top-products", response_model=list[TopProduct])
async def top_products(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    data = await get_top_products(db, current_profile.id, limit)
    return [TopProduct(**d) for d in data]


@router.get("/summary", response_model=AnalyticsSummary)
async def summary(
    days: int | None = Query(None, ge=1, le=365, description="Limite aux N derniers jours ; omis = toute la periode"),
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    base = await get_summary(db, current_profile, days)
    daily = await get_daily_sales(db, current_profile.id, days or 30)
    top = await get_top_products(db, current_profile.id, 10)
    return AnalyticsSummary(
        total_orders=base["total_orders"],
        total_revenue=base["total_revenue"],
        total_customers=base["total_customers"],
        average_order_value=base["average_order_value"],
        daily_sales=[DailySales(**d) for d in daily],
        top_products=[TopProduct(**d) for d in top],
        quota=base["quota"],
    )


@router.get("/insights", response_model=AnalyticsInsights)
async def insights(
    days: int | None = Query(30, ge=1, le=365, description="Fenetre d'analyse ; omis = toute la periode"),
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    return AnalyticsInsights(**await get_insights(db, current_profile, days))
