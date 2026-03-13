import re
import difflib
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sql_update, delete as sql_delete, func
from typing import Optional, Literal
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app.models.account import Account, AccountType, AccountStatus
from app.models.contact import Contact
from app.models.lead import Lead
from app.models.deal import Deal
from app.models.activity import Activity, RelatedToType
from app.models.user import User
from app.schemas.account import AccountCreate, AccountUpdate, AccountOut
from app.services.auth_service import get_current_user, require_admin
from app.routers.audit_log import log_event, AuditAction

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _norm(s: str) -> str:
    """Normalize a name for fuzzy comparison."""
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


@router.get("", response_model=list[AccountOut])
async def list_accounts(
    type: Optional[AccountType] = None,
    status: Optional[AccountStatus] = None,
    owner: Optional[int] = None,
    region: Optional[str] = None,
    search: Optional[str] = None,
    created_after: Optional[datetime] = None,
    created_before: Optional[datetime] = None,
    skip: int = 0,
    limit: int = Query(50, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Account)
    if type:
        q = q.where(Account.type == type)
    if status:
        q = q.where(Account.status == status)
    if owner:
        q = q.where(Account.account_manager_id == owner)
    if region:
        q = q.where(Account.region == region)
    if search:
        q = q.where(Account.name.ilike(f"%{search}%"))
    if created_after:
        q = q.where(Account.created_at >= created_after)
    if created_before:
        q = q.where(Account.created_at <= created_before)
    q = q.offset(skip).limit(limit).order_by(Account.name)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: AccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = Account(**payload.model_dump())
    db.add(account)
    await db.flush()
    await log_event(db, entity_type="account", entity_id=account.id,
                    action=AuditAction.create, user=current_user,
                    note=f"Account '{account.name}' created")
    return account


# ── Duplicate detection (must be before /{account_id} to avoid routing conflict) ──

@router.get("/duplicates")
async def find_account_duplicates(
    threshold: float = Query(0.82, ge=0.5, le=1.0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return pairs of accounts with similar names (similarity >= threshold)."""
    result = await db.execute(select(Account).order_by(Account.name))
    accounts = result.scalars().all()

    pairs = []
    normed = [(a, _norm(a.name)) for a in accounts]

    for i in range(len(normed)):
        for j in range(i + 1, len(normed)):
            a, na = normed[i]
            b, nb = normed[j]
            if not na or not nb:
                continue
            ratio = difflib.SequenceMatcher(None, na, nb).ratio()
            if ratio >= threshold:
                pairs.append({
                    "a": AccountOut.model_validate(a),
                    "b": AccountOut.model_validate(b),
                    "similarity": round(ratio * 100),
                })
                if len(pairs) >= 200:  # safety cap
                    return pairs

    return pairs


@router.post("/merge", response_model=AccountOut)
async def merge_accounts(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Merge duplicate_id into primary_id:
    - Reassigns all contacts, leads, deals, activities to primary.
    - Fills empty primary fields from duplicate.
    - Deletes the duplicate account.
    """
    primary_id: int = body.get("primary_id")
    duplicate_id: int = body.get("duplicate_id")

    if not primary_id or not duplicate_id:
        raise HTTPException(status_code=400, detail="primary_id and duplicate_id are required")
    if primary_id == duplicate_id:
        raise HTTPException(status_code=400, detail="Cannot merge an account with itself")

    primary_res = await db.execute(select(Account).where(Account.id == primary_id))
    primary = primary_res.scalar_one_or_none()
    if not primary:
        raise HTTPException(status_code=404, detail="Primary account not found")

    dup_res = await db.execute(select(Account).where(Account.id == duplicate_id))
    duplicate = dup_res.scalar_one_or_none()
    if not duplicate:
        raise HTTPException(status_code=404, detail="Duplicate account not found")

    # Fill missing fields on primary from duplicate
    for field in ["industry", "website", "address", "country", "region", "segment",
                  "jira_ticket_id", "notes", "account_manager_id"]:
        if not getattr(primary, field) and getattr(duplicate, field):
            setattr(primary, field, getattr(duplicate, field))

    # Reassign all child records (bypass ORM cascade with bulk UPDATE)
    await db.execute(
        sql_update(Contact).where(Contact.account_id == duplicate_id)
        .values(account_id=primary_id)
    )
    await db.execute(
        sql_update(Lead).where(Lead.account_id == duplicate_id)
        .values(account_id=primary_id)
    )
    await db.execute(
        sql_update(Deal).where(Deal.account_id == duplicate_id)
        .values(account_id=primary_id)
    )
    await db.execute(
        sql_update(Activity)
        .where(Activity.related_to_type == RelatedToType.account,
               Activity.related_to_id == duplicate_id)
        .values(related_to_id=primary_id)
    )

    # Delete duplicate directly (skip ORM cascade to avoid conflicts)
    await db.execute(sql_delete(Account).where(Account.id == duplicate_id))
    await db.flush()

    return AccountOut.model_validate(primary)


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/{account_id}", response_model=AccountOut)
async def get_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.patch("/{account_id}", response_model=AccountOut)
async def update_account(
    account_id: int,
    payload: AccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    updates = payload.model_dump(exclude_none=True)
    changes = {k: {"old": getattr(account, k, None), "new": v}
               for k, v in updates.items() if getattr(account, k, None) != v}
    for field, value in updates.items():
        setattr(account, field, value)
    if changes:
        await log_event(db, entity_type="account", entity_id=account_id,
                        action=AuditAction.update, user=current_user, changes=changes)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    await log_event(db, entity_type="account", entity_id=account_id,
                    action=AuditAction.delete, user=current_user,
                    note=f"Account '{account.name}' deleted")
    await db.delete(account)


class AccountBulkAction(BaseModel):
    action: Literal["delete", "update_status"]
    ids: list[int]
    status: AccountStatus | None = None


@router.post("/bulk")
async def bulk_accounts(
    payload: AccountBulkAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.ids:
        raise HTTPException(status_code=400, detail="No IDs provided")
    result = await db.execute(select(Account).where(Account.id.in_(payload.ids)))
    accounts = result.scalars().all()
    if payload.action == "delete":
        for account in accounts:
            await db.delete(account)
    elif payload.action == "update_status":
        if payload.status is None:
            raise HTTPException(status_code=400, detail="status required")
        for account in accounts:
            account.status = payload.status
    await db.flush()
    return {"affected": len(accounts)}
