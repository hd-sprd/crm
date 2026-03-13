from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.quote import QuoteStatus


class LineItem(BaseModel):
    product: str
    qty: int
    unit_price: float
    total: float


class QuoteCreate(BaseModel):
    deal_id: int
    line_items: list[LineItem] = []
    shipping_cost: float = 0
    production_cost: float = 0
    payment_terms: Optional[str] = None
    validity_days: int = 30
    notes: Optional[str] = None


class QuoteUpdate(BaseModel):
    line_items: Optional[list[LineItem]] = None
    shipping_cost: Optional[float] = None
    production_cost: Optional[float] = None
    payment_terms: Optional[str] = None
    validity_days: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[QuoteStatus] = None


class QuoteOut(BaseModel):
    id: int
    deal_id: int
    version: int
    line_items: list[dict]
    shipping_cost: float
    production_cost: float
    total_value: float
    status: QuoteStatus
    payment_terms: Optional[str]
    validity_days: int
    notes: Optional[str]
    sent_at: Optional[datetime]
    accepted_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
