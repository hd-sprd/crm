from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class ContactCreate(BaseModel):
    account_id: int
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    is_primary: bool = False
    custom_fields: Optional[dict] = None


class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    is_primary: Optional[bool] = None
    custom_fields: Optional[dict] = None


class ContactOut(BaseModel):
    id: int
    account_id: int
    first_name: str
    last_name: str
    email: Optional[str]
    phone: Optional[str]
    title: Optional[str]
    is_primary: bool
    custom_fields: Optional[dict]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
