from __future__ import annotations

from pydantic import BaseModel


class DailySales(BaseModel):
    date: str
    order_count: int
    total_revenue: float


class TopProduct(BaseModel):
    product_id: str
    product_name: str
    total_quantity: int
    total_revenue: float


class AnalyticsSummary(BaseModel):
    total_orders: int
    total_revenue: float
    total_customers: int
    average_order_value: float
    daily_sales: list[DailySales]
    top_products: list[TopProduct]
