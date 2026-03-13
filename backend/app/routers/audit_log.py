"""
Audit Log – read-only endpoint for viewing change history.
Write access is via log_event() helper called from other routers.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models.audit_log import AuditLog, AuditAction
from app.models.user import User
from app.services.auth_service import get_current_user, require_admin

router = APIRouter(prefix="/audit-log", tags=["audit-log"])


class AuditLogOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    action: AuditAction
    user_id: Optional[int]
    user_name: Optional[str]
    changes: Optional[dict]
    note: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


@router.get("", response_model=list[AuditLogOut])
async def list_audit_log(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    action: Optional[AuditAction] = None,
    skip: int = 0,
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(AuditLog).order_by(desc(AuditLog.created_at))
    if entity_type:
        q = q.where(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        q = q.where(AuditLog.entity_id == entity_id)
    if action:
        q = q.where(AuditLog.action == action)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


# ── Service helper (import from other routers) ────────────────────────────────

async def log_event(
    db: AsyncSession,
    *,
    entity_type: str,
    entity_id: int,
    action: AuditAction,
    user: User | None = None,
    changes: dict | None = None,
    note: str | None = None,
) -> None:
    """Write one audit log entry. Safe to call from any router."""
    entry = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        user_id=user.id if user else None,
        user_name=user.full_name if user else None,
        changes=changes,
        note=note,
    )
    db.add(entry)
    # No flush needed – will be committed with the parent transaction
