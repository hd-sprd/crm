from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel
from app.models.task import TaskPriority, TaskStatus, RelatedToType


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    related_to_type: Optional[RelatedToType] = None
    related_to_id: Optional[int] = None
    assigned_to: Optional[int] = None
    due_date: Optional[date] = None
    priority: TaskPriority = TaskPriority.medium


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[int] = None
    due_date: Optional[date] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    related_to_type: Optional[RelatedToType] = None
    related_to_id: Optional[int] = None


class TaskOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    related_to_type: Optional[RelatedToType]
    related_to_id: Optional[int]
    assigned_to: Optional[int]
    assigned_user_name: Optional[str] = None
    due_date: Optional[date]
    priority: TaskPriority
    status: TaskStatus
    is_auto_generated: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
