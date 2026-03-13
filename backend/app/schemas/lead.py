from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from app.models.lead import LeadSource, LeadStatus


class LeadCreate(BaseModel):
    source: LeadSource
    account_id: Optional[int] = None
    contact_id: Optional[int] = None
    assigned_to: Optional[int] = None
    status: LeadStatus = LeadStatus.new
    qualification_notes: Optional[str] = None
    use_case: Optional[str] = None
    estimated_volume: Optional[int] = None
    timeline: Optional[str] = None
    company_name: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_name: Optional[str] = None


class LeadUpdate(BaseModel):
    source: Optional[LeadSource] = None
    account_id: Optional[int] = None
    contact_id: Optional[int] = None
    assigned_to: Optional[int] = None
    status: Optional[LeadStatus] = None
    qualification_notes: Optional[str] = None
    use_case: Optional[str] = None
    estimated_volume: Optional[int] = None
    timeline: Optional[str] = None
    company_name: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_name: Optional[str] = None


class LeadOut(BaseModel):
    id: int
    source: LeadSource
    account_id: Optional[int]
    contact_id: Optional[int]
    assigned_to: Optional[int]
    status: LeadStatus
    qualification_notes: Optional[str]
    use_case: Optional[str]
    estimated_volume: Optional[int]
    timeline: Optional[str]
    company_name: Optional[str]
    contact_email: Optional[str]
    contact_name: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LeadConvert(BaseModel):
    """Payload to convert a lead into a deal (+ optionally create account/contact)."""
    create_account: bool = True
    account_name: Optional[str] = None
    account_type: str = "B2B"
    deal_title: str
    deal_value_eur: Optional[float] = None
    assigned_to: Optional[int] = None
