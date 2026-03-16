from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.quote import QuoteStatus


class LineItem(BaseModel):
    product: str
    qty: int
    unit_price: float
    total: float
    print_colors: Optional[str] = None
    print_technique: Optional[str] = None
    print_size: Optional[str] = None
    image_url: Optional[str] = None


class QuoteCreate(BaseModel):
    deal_id: int
    line_items: list[LineItem] = []
    shipping_cost: float = 0
    production_cost: float = 0
    currency: str = "EUR"
    exchange_rate_eur: float = 1.0
    payment_terms: Optional[str] = None
    validity_days: int = 30
    notes: Optional[str] = None
    custom_fields: Optional[dict] = None


class QuoteUpdate(BaseModel):
    line_items: Optional[list[LineItem]] = None
    shipping_cost: Optional[float] = None
    production_cost: Optional[float] = None
    currency: Optional[str] = None
    exchange_rate_eur: Optional[float] = None
    payment_terms: Optional[str] = None
    validity_days: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[QuoteStatus] = None
    custom_fields: Optional[dict] = None


class QuoteOut(BaseModel):
    id: int
    deal_id: int
    version: int
    line_items: list[dict]
    shipping_cost: float
    production_cost: float
    total_value: float
    currency: str
    exchange_rate_eur: float
    status: QuoteStatus
    payment_terms: Optional[str]
    validity_days: int
    notes: Optional[str]
    custom_fields: Optional[dict]
    access_token: Optional[str] = None
    sent_at: Optional[datetime]
    accepted_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
