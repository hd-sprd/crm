from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.account import AccountType, AccountStatus


class AccountCreate(BaseModel):
    name: str
    type: AccountType
    segment: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    status: AccountStatus = AccountStatus.prospect
    account_manager_id: Optional[int] = None
    jira_ticket_id: Optional[str] = None
    notes: Optional[str] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[AccountType] = None
    segment: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    status: Optional[AccountStatus] = None
    account_manager_id: Optional[int] = None
    jira_ticket_id: Optional[str] = None
    notes: Optional[str] = None


class AccountOut(BaseModel):
    id: int
    name: str
    type: AccountType
    segment: Optional[str]
    industry: Optional[str]
    website: Optional[str]
    address: Optional[str]
    country: Optional[str]
    region: Optional[str]
    status: AccountStatus
    account_manager_id: Optional[int]
    jira_ticket_id: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
