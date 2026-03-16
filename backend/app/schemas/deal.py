from datetime import datetime, date
from typing import Optional, Any
from pydantic import BaseModel
from app.models.deal import DealType


class DealCreate(BaseModel):
    title: str
    account_id: int
    contact_id: Optional[int] = None
    assigned_to: Optional[int] = None
    type: DealType = DealType.standard
    stage: str = "lead_received"
    product_type: Optional[str] = None
    quantity: Optional[int] = None
    branding_requirements: Optional[str] = None
    shipping_location: Optional[str] = None
    value_eur: Optional[float] = None
    currency: str = "EUR"
    exchange_rate_eur: float = 1.0
    probability: int = 0
    expected_close_date: Optional[date] = None
    jira_ticket_id: Optional[str] = None
    custom_fields: Optional[dict[str, Any]] = None


class DealUpdate(BaseModel):
    title: Optional[str] = None
    contact_id: Optional[int] = None
    assigned_to: Optional[int] = None
    type: Optional[DealType] = None
    product_type: Optional[str] = None
    quantity: Optional[int] = None
    branding_requirements: Optional[str] = None
    shipping_location: Optional[str] = None
    feasibility_checked: Optional[bool] = None
    feasibility_notes: Optional[str] = None
    quote_id: Optional[int] = None
    order_reference: Optional[str] = None
    artwork_approved: Optional[bool] = None
    invoice_reference: Optional[str] = None
    payment_received: Optional[bool] = None
    value_eur: Optional[float] = None
    currency: Optional[str] = None
    exchange_rate_eur: Optional[float] = None
    probability: Optional[int] = None
    expected_close_date: Optional[date] = None
    lost_reason: Optional[str] = None
    jira_ticket_id: Optional[str] = None
    custom_fields: Optional[dict[str, Any]] = None


class DealStageChange(BaseModel):
    stage: str
    lost_reason: Optional[str] = None


class DealOut(BaseModel):
    id: int
    title: str
    account_id: int
    contact_id: Optional[int]
    assigned_to: Optional[int]
    type: DealType
    stage: str
    product_type: Optional[str]
    quantity: Optional[int]
    branding_requirements: Optional[str]
    shipping_location: Optional[str]
    feasibility_checked: bool
    feasibility_notes: Optional[str]
    quote_id: Optional[int]
    order_reference: Optional[str]
    artwork_approved: bool
    invoice_reference: Optional[str]
    payment_received: bool
    value_eur: Optional[float]
    currency: str
    exchange_rate_eur: float
    probability: int
    expected_close_date: Optional[date]
    lost_reason: Optional[str]
    jira_ticket_id: Optional[str]
    custom_fields: Optional[dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
