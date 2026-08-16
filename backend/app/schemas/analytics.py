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


class QuotaUsage(BaseModel):
    plan: str
    conversations_used: int
    conversations_limit: int
    followups_used: int
    followups_limit: int
    period_start: str
    period_end: str


class AnalyticsSummary(BaseModel):
    total_orders: int
    total_revenue: float
    total_customers: int
    average_order_value: float
    daily_sales: list[DailySales]
    top_products: list[TopProduct]
    quota: QuotaUsage


class GeoBreakdownItem(BaseModel):
    neighborhood: str
    order_count: int
    total_revenue: float


class ConversionStats(BaseModel):
    total_conversations: int
    converted: int
    lost: int
    in_progress: int
    escalated: int
    conversion_rate: float


class PeakHourItem(BaseModel):
    hour: int
    order_count: int


class FollowupPerformance(BaseModel):
    sent: int
    responded: int
    converted: int
    recovered_amount: float
    response_rate: float
    conversion_rate: float


class NegotiationImpact(BaseModel):
    negotiated_orders: int
    total_orders: int
    negotiated_share: float
    average_discount_pct: float
    total_discount_amount: float


class LeakingConversation(BaseModel):
    customer_name: str
    whatsapp_phone: str
    outcome: str
    last_message_at: str | None
    estimated_amount: float | None


class LeakingSales(BaseModel):
    count: int
    estimated_amount: float
    items: list[LeakingConversation]


class CustomerSegments(BaseModel):
    new_customers: int
    returning_customers: int
    repeat_rate: float


class AnalyticsInsights(BaseModel):
    daily_sales: list[DailySales]
    geo_breakdown: list[GeoBreakdownItem]
    conversion: ConversionStats
    peak_hours: list[PeakHourItem]
    followups: FollowupPerformance
    negotiation: NegotiationImpact
    leaking_sales: LeakingSales
    segments: CustomerSegments
    quota: QuotaUsage
