from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.activity import ActivityType, RelatedToType


class ActivityCreate(BaseModel):
    type: ActivityType
    related_to_type: RelatedToType
    related_to_id: int
    assigned_to: Optional[int] = None
    subject: str
    body: Optional[str] = None
    due_date: Optional[datetime] = None
    ms_message_id: Optional[str] = None


class ActivityUpdate(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    ms_message_id: Optional[str] = None


class ActivityOut(BaseModel):
    id: int
    type: ActivityType
    related_to_type: RelatedToType
    related_to_id: int
    assigned_to: Optional[int]
    assigned_user_name: Optional[str] = None
    subject: str
    body: Optional[str]
    due_date: Optional[datetime]
    completed_at: Optional[datetime]
    is_overdue: bool
    ms_message_id: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        instance = super().model_validate(obj, *args, **kwargs)
        try:
            if obj.assigned_user:
                instance.assigned_user_name = obj.assigned_user.full_name
        except Exception:
            pass
        return instance
