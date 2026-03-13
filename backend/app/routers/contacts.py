import re
import difflib
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sql_update, delete as sql_delete
from typing import Optional, Literal
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app.models.contact import Contact
from app.models.lead import Lead
from app.models.deal import Deal
from app.models.activity import Activity, RelatedToType
from app.models.user import User
from app.schemas.contact import ContactCreate, ContactUpdate, ContactOut
from app.services.auth_service import get_current_user, require_admin
from app.routers.audit_log import log_event, AuditAction

router = APIRouter(prefix="/contacts", tags=["contacts"])


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


@router.get("", response_model=list[ContactOut])
async def list_contacts(
    account_id: Optional[int] = None,
    search: Optional[str] = None,
    created_after: Optional[datetime] = None,
    created_before: Optional[datetime] = None,
    skip: int = 0,
    limit: int = Query(50, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Contact)
    if account_id:
        q = q.where(Contact.account_id == account_id)
    if search:
        q = q.where(
            (Contact.first_name + " " + Contact.last_name).ilike(f"%{search}%")
            | Contact.email.ilike(f"%{search}%")
        )
    if created_after:
        q = q.where(Contact.created_at >= created_after)
    if created_before:
        q = q.where(Contact.created_at <= created_before)
    q = q.offset(skip).limit(limit).order_by(Contact.last_name)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
async def create_contact(
    payload: ContactCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = Contact(**payload.model_dump())
    db.add(contact)
    await db.flush()
    await log_event(db, entity_type="contact", entity_id=contact.id,
                    action=AuditAction.create, user=current_user,
                    note=f"Contact '{contact.first_name} {contact.last_name}' created")
    return contact


# ── Duplicate detection (must be before /{contact_id}) ────────────────────────

@router.get("/duplicates")
async def find_contact_duplicates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns pairs of duplicate contacts:
    - Same email address (case-insensitive), OR
    - Same normalized full name with similarity >= 0.90
    """
    result = await db.execute(select(Contact).order_by(Contact.last_name, Contact.first_name))
    contacts = result.scalars().all()

    pairs = []
    seen = set()

    for i in range(len(contacts)):
        for j in range(i + 1, len(contacts)):
            a, b = contacts[i], contacts[j]
            pair_key = (a.id, b.id)
            if pair_key in seen:
                continue

            similarity = 0
            reason = ""

            # Exact email match
            if a.email and b.email and a.email.lower() == b.email.lower():
                similarity = 100
                reason = "Same email"
            else:
                # Name similarity
                na = _norm(f"{a.first_name}{a.last_name}")
                nb = _norm(f"{b.first_name}{b.last_name}")
                if na and nb:
                    ratio = difflib.SequenceMatcher(None, na, nb).ratio()
                    if ratio >= 0.90:
                        similarity = round(ratio * 100)
                        reason = "Similar name"

            if similarity:
                seen.add(pair_key)
                pairs.append({
                    "a": ContactOut.model_validate(a),
                    "b": ContactOut.model_validate(b),
                    "similarity": similarity,
                    "reason": reason,
                })
                if len(pairs) >= 200:
                    return pairs

    return pairs


@router.post("/merge", response_model=ContactOut)
async def merge_contacts(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Merge duplicate_id into primary_id:
    - Reassigns all leads, deals, activities to primary.
    - Fills empty primary fields from duplicate.
    - Deletes the duplicate contact.
    """
    primary_id: int = body.get("primary_id")
    duplicate_id: int = body.get("duplicate_id")

    if not primary_id or not duplicate_id:
        raise HTTPException(status_code=400, detail="primary_id and duplicate_id are required")
    if primary_id == duplicate_id:
        raise HTTPException(status_code=400, detail="Cannot merge a contact with itself")

    primary_res = await db.execute(select(Contact).where(Contact.id == primary_id))
    primary = primary_res.scalar_one_or_none()
    if not primary:
        raise HTTPException(status_code=404, detail="Primary contact not found")

    dup_res = await db.execute(select(Contact).where(Contact.id == duplicate_id))
    duplicate = dup_res.scalar_one_or_none()
    if not duplicate:
        raise HTTPException(status_code=404, detail="Duplicate contact not found")

    # Fill missing fields on primary from duplicate
    for field in ["email", "phone", "title"]:
        if not getattr(primary, field) and getattr(duplicate, field):
            setattr(primary, field, getattr(duplicate, field))

    # Ensure primary is marked as primary if either was
    if duplicate.is_primary:
        primary.is_primary = True

    # Reassign all child records
    await db.execute(
        sql_update(Lead).where(Lead.contact_id == duplicate_id)
        .values(contact_id=primary_id)
    )
    await db.execute(
        sql_update(Deal).where(Deal.contact_id == duplicate_id)
        .values(contact_id=primary_id)
    )
    await db.execute(
        sql_update(Activity)
        .where(Activity.related_to_type == RelatedToType.contact,
               Activity.related_to_id == duplicate_id)
        .values(related_to_id=primary_id)
    )

    await db.execute(sql_delete(Contact).where(Contact.id == duplicate_id))
    await db.flush()

    return ContactOut.model_validate(primary)


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/{contact_id}", response_model=ContactOut)
async def get_contact(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.patch("/{contact_id}", response_model=ContactOut)
async def update_contact(
    contact_id: int,
    payload: ContactUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    updates = payload.model_dump(exclude_none=True)
    changes = {k: {"old": getattr(contact, k, None), "new": v}
               for k, v in updates.items() if getattr(contact, k, None) != v}
    for field, value in updates.items():
        setattr(contact, field, value)
    if changes:
        await log_event(db, entity_type="contact", entity_id=contact_id,
                        action=AuditAction.update, user=current_user, changes=changes)
    return contact


class ContactBulkAction(BaseModel):
    action: Literal["delete"]
    ids: list[int]


@router.post("/bulk")
async def bulk_contacts(
    payload: ContactBulkAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.ids:
        raise HTTPException(status_code=400, detail="No IDs provided")
    result = await db.execute(select(Contact).where(Contact.id.in_(payload.ids)))
    contacts = result.scalars().all()
    if payload.action == "delete":
        for contact in contacts:
            await db.delete(contact)
    await db.flush()
    return {"affected": len(contacts)}
