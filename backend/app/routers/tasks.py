from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, Literal
from datetime import date, datetime
from pydantic import BaseModel

from app.database import get_db
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.user import User
from app.schemas.task import TaskCreate, TaskUpdate, TaskOut
from app.services.auth_service import get_current_user
from app.routers.notifications import create_notification

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskOut])
async def list_tasks(
    status: Optional[TaskStatus] = None,
    assigned_to: Optional[int] = None,
    priority: Optional[TaskPriority] = None,
    overdue: Optional[bool] = None,
    search: Optional[str] = None,
    created_after: Optional[datetime] = None,
    created_before: Optional[datetime] = None,
    skip: int = 0,
    limit: int = Query(50, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Task)
    if status:
        q = q.where(Task.status == status)
    if assigned_to:
        q = q.where(Task.assigned_to == assigned_to)
    if priority:
        q = q.where(Task.priority == priority)
    if overdue is True:
        q = q.where(Task.due_date < date.today(), Task.status == TaskStatus.open)
    if search:
        q = q.where(Task.title.ilike(f"%{search}%"))
    if created_after:
        q = q.where(Task.created_at >= created_after)
    if created_before:
        q = q.where(Task.created_at <= created_before)
    q = q.offset(skip).limit(limit).order_by(Task.due_date.asc().nulls_last())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = Task(**payload.model_dump())
    if not task.assigned_to:
        task.assigned_to = current_user.id
    db.add(task)
    await db.flush()
    # Notify assignee if different from creator
    if task.assigned_to and task.assigned_to != current_user.id:
        await create_notification(
            db,
            user_id=task.assigned_to,
            type="task_assigned",
            title=f"New task assigned: {task.title}",
            body=f"Assigned by {current_user.full_name}",
            entity_type="task",
            entity_id=task.id,
        )
    return task


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(task, field, value)
    return task


class TaskBulkAction(BaseModel):
    action: Literal["delete", "assign", "update_status"]
    ids: list[int]
    assign_to: int | None = None
    status: TaskStatus | None = None


@router.post("/bulk")
async def bulk_tasks(
    payload: TaskBulkAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.ids:
        raise HTTPException(status_code=400, detail="No IDs provided")
    result = await db.execute(select(Task).where(Task.id.in_(payload.ids)))
    tasks = result.scalars().all()
    if payload.action == "delete":
        for task in tasks:
            await db.delete(task)
    elif payload.action == "assign":
        if payload.assign_to is None:
            raise HTTPException(status_code=400, detail="assign_to required")
        for task in tasks:
            task.assigned_to = payload.assign_to
    elif payload.action == "update_status":
        if payload.status is None:
            raise HTTPException(status_code=400, detail="status required")
        for task in tasks:
            task.status = payload.status
    await db.flush()
    return {"affected": len(tasks)}
