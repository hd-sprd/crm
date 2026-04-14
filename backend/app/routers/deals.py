from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, Literal
from datetime import datetime, timezone


def _utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
from pydantic import BaseModel

from app.database import get_db
from app.models.deal import Deal, DealType
from app.models.user import User
from app.schemas.deal import DealCreate, DealUpdate, DealOut, DealStageChange
from app.services.auth_service import get_current_user
from app.services.deal_service import validate_stage_transition, get_default_workflow_id, get_first_stage_key
from app.routers.audit_log import log_event, AuditAction
from app.routers.notifications import create_notification

router = APIRouter(prefix="/deals", tags=["deals"])


@router.get("", response_model=list[DealOut])
async def list_deals(
    stage: Optional[str] = None,
    workflow_id: Optional[int] = None,
    assigned_to: Optional[int] = None,
    account_id: Optional[int] = None,
    type: Optional[DealType] = None,
    search: Optional[str] = None,
    created_after: Optional[datetime] = None,
    created_before: Optional[datetime] = None,
    skip: int = 0,
    limit: int = Query(50, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Deal)
    if stage:
        q = q.where(Deal.stage == stage)
    if workflow_id:
        q = q.where(Deal.workflow_id == workflow_id)
    if assigned_to:
        q = q.where(Deal.assigned_to == assigned_to)
    if account_id:
        q = q.where(Deal.account_id == account_id)
    if type:
        q = q.where(Deal.type == type)
    if search:
        q = q.where(Deal.title.ilike(f"%{search}%"))
    if created_after:
        q = q.where(Deal.created_at >= _utc(created_after))
    if created_before:
        q = q.where(Deal.created_at <= _utc(created_before))
    q = q.offset(skip).limit(limit).order_by(Deal.updated_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=DealOut, status_code=status.HTTP_201_CREATED)
async def create_deal(
    payload: DealCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = payload.model_dump()
    # Resolve workflow_id – fall back to default workflow
    if not data.get("workflow_id"):
        data["workflow_id"] = await get_default_workflow_id(db)
    # Set initial stage to first stage of the workflow (unless explicitly provided)
    if not data.get("stage") or data["stage"] == "lead_received":
        if data.get("workflow_id"):
            data["stage"] = await get_first_stage_key(data["workflow_id"], db)
    deal = Deal(**data)
    if not deal.assigned_to:
        deal.assigned_to = current_user.id
    db.add(deal)
    await db.flush()
    await log_event(db, entity_type="deal", entity_id=deal.id, action=AuditAction.create,
                    user=current_user, note=f"Created: {deal.title}")
    if deal.assigned_to and deal.assigned_to != current_user.id:
        await create_notification(db, user_id=deal.assigned_to, type="deal_assigned",
                                  title=f"New deal assigned: {deal.title}",
                                  body=f"Assigned by {current_user.full_name}",
                                  entity_type="deal", entity_id=deal.id)
    return deal


@router.get("/{deal_id}", response_model=DealOut)
async def get_deal(
    deal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.patch("/{deal_id}", response_model=DealOut)
async def update_deal(
    deal_id: int,
    payload: DealUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    changes = {}
    old_assignee = deal.assigned_to
    for field, value in payload.model_dump(exclude_none=True).items():
        old_val = getattr(deal, field, None)
        if old_val != value:
            changes[field] = [str(old_val) if old_val is not None else None,
                              str(value) if value is not None else None]
        setattr(deal, field, value)
    if changes:
        await log_event(db, entity_type="deal", entity_id=deal.id, action=AuditAction.update,
                        user=current_user, changes=changes)
    if deal.assigned_to and deal.assigned_to != old_assignee and deal.assigned_to != current_user.id:
        await create_notification(db, user_id=deal.assigned_to, type="deal_assigned",
                                  title=f"New deal assigned: {deal.title}",
                                  body=f"Assigned by {current_user.full_name}",
                                  entity_type="deal", entity_id=deal.id)
    return deal


@router.post("/{deal_id}/stage", response_model=DealOut)
async def change_stage(
    deal_id: int,
    payload: DealStageChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if payload.lost_reason:
        deal.lost_reason = payload.lost_reason
    old_stage = deal.stage
    await validate_stage_transition(deal, payload.stage, db)
    deal.stage = payload.stage
    await log_event(db, entity_type="deal", entity_id=deal.id, action=AuditAction.update,
                    user=current_user, changes={"stage": [old_stage, payload.stage]})
    if deal.assigned_to:
        await create_notification(db, user_id=deal.assigned_to, type="deal_stage_change",
                                  title=f"Deal '{deal.title}' moved to {payload.stage}",
                                  body=f"Changed by {current_user.full_name}",
                                  entity_type="deal", entity_id=deal.id)
    return deal


@router.delete("/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deal(
    deal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    await log_event(db, entity_type="deal", entity_id=deal_id, action=AuditAction.delete,
                    user=current_user, note=f"Deleted: {deal.title}")
    await db.delete(deal)


class DealBulkAction(BaseModel):
    action: Literal["delete", "assign"]
    ids: list[int]
    assign_to: int | None = None


@router.post("/bulk")
async def bulk_deals(
    payload: DealBulkAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.ids:
        raise HTTPException(status_code=400, detail="No IDs provided")
    result = await db.execute(select(Deal).where(Deal.id.in_(payload.ids)))
    deals = result.scalars().all()
    if payload.action == "delete":
        for deal in deals:
            await log_event(db, entity_type="deal", entity_id=deal.id, action=AuditAction.delete,
                            user=current_user, note=f"Bulk deleted: {deal.title}")
            await db.delete(deal)
    elif payload.action == "assign":
        if payload.assign_to is None:
            raise HTTPException(status_code=400, detail="assign_to required")
        for deal in deals:
            old_assignee = deal.assigned_to
            deal.assigned_to = payload.assign_to
            await log_event(db, entity_type="deal", entity_id=deal.id, action=AuditAction.update,
                            user=current_user, changes={"assigned_to": [str(old_assignee), str(payload.assign_to)]})
            if payload.assign_to != current_user.id:
                await create_notification(db, user_id=payload.assign_to, type="deal_assigned",
                                          title=f"New deal assigned: {deal.title}",
                                          body=f"Assigned by {current_user.full_name}",
                                          entity_type="deal", entity_id=deal.id)
    await db.flush()
    return {"affected": len(deals)}
