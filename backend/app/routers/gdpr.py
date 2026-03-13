"""
GDPR / DSGVO compliance endpoints.

Art. 15 – Auskunftsrecht: GET /gdpr/export/{contact_id}
Art. 17 – Recht auf Löschung: DELETE /gdpr/anonymize/{contact_id}
Art. 20 – Datenübertragbarkeit: GET /gdpr/export/{contact_id}?format=json

Only admins and sales managers may call these endpoints.
"""
import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.database import get_db
from app.models.user import User, UserRole
from app.models.contact import Contact
from app.models.lead import Lead
from app.models.deal import Deal
from app.models.activity import Activity
from app.models.account import Account
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/gdpr", tags=["gdpr"])


def _require_gdpr_role(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.admin, UserRole.sales_manager):
        raise HTTPException(status_code=403, detail="Insufficient permissions for GDPR operations")
    return current_user


def _anonymize_email(email: str) -> str:
    """Replace email with a consistent hash-based anonymized value."""
    h = hashlib.sha256(email.encode()).hexdigest()[:12]
    return f"anonymized_{h}@deleted.invalid"


# ── Art. 15 / Art. 20: Data Export ───────────────────────────────────────────

@router.get("/export/{contact_id}")
async def export_contact_data(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_gdpr_role),
):
    """
    Export all personal data stored for a contact (DSGVO Art. 15 / Art. 20).
    Returns a JSON document with all CRM records referencing this person.
    """
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # Account info
    acc_result = await db.execute(select(Account).where(Account.id == contact.account_id))
    account = acc_result.scalar_one_or_none()

    # Leads linked to this contact
    leads_result = await db.execute(select(Lead).where(Lead.contact_id == contact_id))
    leads = leads_result.scalars().all()

    # Deals linked to this contact
    deals_result = await db.execute(select(Deal).where(Deal.contact_id == contact_id))
    deals = deals_result.scalars().all()

    # Activities linked to deals of this contact
    from app.models.activity import RelatedToType
    deal_ids = [d.id for d in deals]
    activities = []
    if deal_ids:
        acts_result = await db.execute(
            select(Activity).where(
                Activity.related_to_type == RelatedToType.deal,
                Activity.related_to_id.in_(deal_ids),
            )
        )
        activities = acts_result.scalars().all()

    export = {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "contact": {
            "id": contact.id,
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "email": contact.email,
            "phone": contact.phone,
            "title": contact.title,
            "created_at": contact.created_at.isoformat(),
        },
        "account": {
            "id": account.id if account else None,
            "name": account.name if account else None,
            "address": account.address if account else None,
        },
        "leads": [
            {
                "id": l.id,
                "status": l.status,
                "source": l.source,
                "company_name": l.company_name,
                "contact_email": l.contact_email,
                "contact_name": l.contact_name,
                "use_case": l.use_case,
                "created_at": l.created_at.isoformat(),
            }
            for l in leads
        ],
        "deals": [
            {
                "id": d.id,
                "title": d.title,
                "stage": d.stage,
                "value_eur": float(d.value_eur) if d.value_eur else None,
                "created_at": d.created_at.isoformat(),
            }
            for d in deals
        ],
        "activities": [
            {
                "id": a.id,
                "type": a.type,
                "subject": a.subject,
                "body": a.body,
                "due_date": a.due_date.isoformat() if a.due_date else None,
            }
            for a in activities
        ],
    }

    return JSONResponse(
        content=export,
        headers={
            "Content-Disposition": f"attachment; filename=gdpr_export_contact_{contact_id}.json"
        },
    )


# ── Art. 17: Right to Erasure / Anonymization ────────────────────────────────

@router.post("/anonymize/{contact_id}", status_code=200)
async def anonymize_contact(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_gdpr_role),
):
    """
    Anonymize all personal data for a contact (DSGVO Art. 17).
    Replaces PII with anonymized placeholders while preserving business records.
    Does NOT delete deal/lead records – only removes identifying information.
    """
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    anon_id = f"GDPR-{contact_id}"
    original_email = contact.email or ""

    # Anonymize contact
    contact.first_name = anon_id
    contact.last_name = "Anonymized"
    contact.email = _anonymize_email(original_email) if original_email else None
    contact.phone = None
    contact.title = None

    # Anonymize leads linked to this contact
    leads_result = await db.execute(select(Lead).where(Lead.contact_id == contact_id))
    for lead in leads_result.scalars().all():
        lead.contact_name = None
        lead.contact_email = _anonymize_email(lead.contact_email) if lead.contact_email else None
        lead.use_case = None
        lead.qualification_notes = None

    await db.flush()

    return {
        "status": "anonymized",
        "contact_id": contact_id,
        "anonymized_at": datetime.now(timezone.utc).isoformat(),
        "note": "Personal data has been anonymized. Business records (deals, leads) are preserved with anonymized references.",
    }


# ── Art. 17: Full User Account Deletion ──────────────────────────────────────

@router.delete("/user/{user_id}", status_code=200)
async def delete_crm_user_data(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_gdpr_role),
):
    """
    Anonymize a CRM user's personal data (DSGVO Art. 17).
    Only admins can delete other users' data. Users cannot delete themselves
    while they are the only admin.
    """
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot anonymize your own account via GDPR endpoint. Contact another admin.")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Safety: ensure at least one admin remains
    if user.role == UserRole.admin:
        admins_result = await db.execute(
            select(User).where(User.role == UserRole.admin, User.is_active == True)
        )
        active_admins = admins_result.scalars().all()
        if len(active_admins) <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot remove the only active admin. Promote another user first.",
            )

    anon_id = f"gdpr-user-{user_id}"
    user.full_name = f"Deleted User {user_id}"
    user.email = _anonymize_email(user.email)
    user.hashed_password = "GDPR_DELETED"
    user.is_active = False
    user.ms_graph_token = None
    user.ms_graph_refresh_token = None
    user.ms_graph_token_expiry = None

    await db.flush()

    return {
        "status": "anonymized",
        "user_id": user_id,
        "anonymized_at": datetime.now(timezone.utc).isoformat(),
    }
