from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, Literal
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app.models.lead import Lead, LeadStatus
from app.models.deal import Deal, DealStage
from app.models.account import Account, AccountType, AccountStatus
from app.models.contact import Contact
from app.models.user import User
from app.schemas.lead import LeadCreate, LeadUpdate, LeadOut, LeadConvert
from app.schemas.deal import DealOut
from app.services.auth_service import get_current_user
from app.routers.notifications import create_notification
from app.routers.audit_log import log_event, AuditAction

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("", response_model=list[LeadOut])
async def list_leads(
    status: Optional[LeadStatus] = None,
    assigned_to: Optional[int] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    created_after: Optional[datetime] = None,
    created_before: Optional[datetime] = None,
    skip: int = 0,
    limit: int = Query(50, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Lead)
    if status:
        q = q.where(Lead.status == status)
    if assigned_to:
        q = q.where(Lead.assigned_to == assigned_to)
    if source:
        q = q.where(Lead.source == source)
    if search:
        s = f"%{search}%"
        q = q.where(
            Lead.company_name.ilike(s) |
            Lead.contact_name.ilike(s) |
            Lead.contact_email.ilike(s)
        )
    if created_after:
        q = q.where(Lead.created_at >= created_after)
    if created_before:
        q = q.where(Lead.created_at <= created_before)
    q = q.offset(skip).limit(limit).order_by(Lead.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
async def create_lead(
    payload: LeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = Lead(**payload.model_dump())
    if not lead.assigned_to:
        lead.assigned_to = current_user.id
    db.add(lead)
    await db.flush()
    await log_event(db, entity_type="lead", entity_id=lead.id, action=AuditAction.create,
                    user=current_user, note=f"Created: {lead.company_name or lead.contact_name}")
    return lead


@router.get("/{lead_id}", response_model=LeadOut)
async def get_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.patch("/{lead_id}", response_model=LeadOut)
async def update_lead(
    lead_id: int,
    payload: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    old_assignee = lead.assigned_to
    changes = {}
    for field, value in payload.model_dump(exclude_none=True).items():
        old_val = getattr(lead, field, None)
        if old_val != value:
            changes[field] = [str(old_val) if old_val is not None else None,
                              str(value) if value is not None else None]
        setattr(lead, field, value)
    if changes:
        await log_event(db, entity_type="lead", entity_id=lead_id, action=AuditAction.update,
                        user=current_user, changes=changes)
    if lead.assigned_to and lead.assigned_to != old_assignee and lead.assigned_to != current_user.id:
        await create_notification(
            db,
            user_id=lead.assigned_to,
            type="lead_assigned",
            title=f"Lead assigned: {lead.company_name or lead.contact_name or f'Lead #{lead.id}'}",
            body=f"Assigned by {current_user.full_name}",
            entity_type="lead",
            entity_id=lead.id,
        )
    return lead


@router.post("/{lead_id}/convert", response_model=DealOut)
async def convert_lead(
    lead_id: int,
    payload: LeadConvert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.status == LeadStatus.converted:
        raise HTTPException(status_code=400, detail="Lead already converted")

    account_id = lead.account_id
    if payload.create_account and not account_id:
        account = Account(
            name=payload.account_name or lead.company_name or "Unnamed Account",
            type=AccountType(payload.account_type),
            status=AccountStatus.prospect,
            account_manager_id=payload.assigned_to or current_user.id,
        )
        db.add(account)
        await db.flush()
        account_id = account.id

    deal = Deal(
        title=payload.deal_title,
        account_id=account_id,
        contact_id=lead.contact_id,
        assigned_to=payload.assigned_to or current_user.id,
        value_eur=payload.deal_value_eur,
        stage=DealStage.lead_qualification,
    )
    db.add(deal)
    lead.status = LeadStatus.converted
    await db.flush()
    return deal


class LeadBulkAction(BaseModel):
    action: Literal["delete", "assign", "update_status"]
    ids: list[int]
    assign_to: int | None = None
    status: LeadStatus | None = None


@router.post("/bulk")
async def bulk_leads(
    payload: LeadBulkAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.ids:
        raise HTTPException(status_code=400, detail="No IDs provided")
    result = await db.execute(select(Lead).where(Lead.id.in_(payload.ids)))
    leads = result.scalars().all()
    if payload.action == "delete":
        for lead in leads:
            await log_event(db, entity_type="lead", entity_id=lead.id, action=AuditAction.delete,
                            user=current_user, note=f"Bulk deleted: {lead.company_name or lead.contact_name}")
            await db.delete(lead)
    elif payload.action == "assign":
        if payload.assign_to is None:
            raise HTTPException(status_code=400, detail="assign_to required")
        for lead in leads:
            lead.assigned_to = payload.assign_to
    elif payload.action == "update_status":
        if payload.status is None:
            raise HTTPException(status_code=400, detail="status required")
        for lead in leads:
            lead.status = payload.status
    await db.flush()
    return {"affected": len(leads)}
