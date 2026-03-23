from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional

from app.database import get_db
from app.models.activity import Activity, ActivityType, RelatedToType
from app.models.user import User
from app.schemas.activity import ActivityCreate, ActivityUpdate, ActivityOut
from app.services.auth_service import get_current_user
from app.routers.audit_log import log_event, AuditAction

router = APIRouter(prefix="/activities", tags=["activities"])


@router.get("", response_model=list[ActivityOut])
async def list_activities(
    type: Optional[ActivityType] = None,
    related_to_type: Optional[RelatedToType] = None,
    related_to_id: Optional[int] = None,
    assigned_to: Optional[int] = None,
    overdue: Optional[bool] = None,
    skip: int = 0,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    q = select(Activity).options(selectinload(Activity.assigned_user))
    if type:
        q = q.where(Activity.type == type)
    if related_to_type:
        q = q.where(Activity.related_to_type == related_to_type)
    if related_to_id:
        q = q.where(Activity.related_to_id == related_to_id)
    if assigned_to:
        q = q.where(Activity.assigned_to == assigned_to)
    if overdue is True:
        now = datetime.now(timezone.utc)
        q = q.where(Activity.due_date < now, Activity.completed_at == None)
    q = q.offset(skip).limit(limit).order_by(Activity.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
async def create_activity(
    payload: ActivityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    activity = Activity(**payload.model_dump())
    if not activity.assigned_to:
        activity.assigned_to = current_user.id
    db.add(activity)
    await db.flush()
    await db.refresh(activity, ["assigned_user"])
    await log_event(db, entity_type="activity", entity_id=activity.id, action=AuditAction.create,
                    user=current_user, note=f"Created: {activity.subject}")
    return activity


@router.get("/{activity_id}", response_model=ActivityOut)
async def get_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Activity).options(selectinload(Activity.assigned_user)).where(Activity.id == activity_id)
    )
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity


@router.patch("/{activity_id}", response_model=ActivityOut)
async def update_activity(
    activity_id: int,
    payload: ActivityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Activity).where(Activity.id == activity_id))
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    changes = {}
    for field, value in payload.model_dump(exclude_none=True).items():
        old_val = getattr(activity, field, None)
        if old_val != value:
            changes[field] = [str(old_val) if old_val is not None else None,
                              str(value) if value is not None else None]
        setattr(activity, field, value)
    if changes:
        await log_event(db, entity_type="activity", entity_id=activity_id, action=AuditAction.update,
                        user=current_user, changes=changes)
    return activity
