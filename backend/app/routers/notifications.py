from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationItem(BaseModel):
    id: int
    type: str
    title: str
    body: Optional[str]
    entity_type: Optional[str]
    entity_id: Optional[int]
    read_at: Optional[datetime]
    created_at: datetime


class NotificationListOut(BaseModel):
    unread_count: int
    items: list[NotificationItem]


# ── Helper (called from other routers) ───────────────────────────────────────

async def create_notification(
    db: AsyncSession,
    *,
    user_id: int,
    type: str,
    title: str,
    body: str | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
) -> None:
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    db.add(notif)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=NotificationListOut)
async def list_notifications(
    unread_only: bool = False,
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import func

    q = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        q = q.where(Notification.read_at.is_(None))
    q = q.order_by(Notification.created_at.desc()).limit(limit)
    result = await db.execute(q)
    items = result.scalars().all()

    count_q = select(func.count()).select_from(Notification).where(
        Notification.user_id == current_user.id,
        Notification.read_at.is_(None),
    )
    unread_count: int = (await db.execute(count_q)).scalar_one()

    return NotificationListOut(
        unread_count=unread_count,
        items=[
            NotificationItem(
                id=n.id,
                type=n.type,
                title=n.title,
                body=n.body,
                entity_type=n.entity_type,
                entity_id=n.entity_id,
                read_at=n.read_at,
                created_at=n.created_at,
            )
            for n in items
        ],
    )


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.read_at = datetime.now(timezone.utc)
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.read_at.is_(None),
        )
    )
    now = datetime.now(timezone.utc)
    for notif in result.scalars().all():
        notif.read_at = now
    return {"ok": True}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.delete(notif)
    return {"ok": True}
