"""
Public (no-auth) endpoints for the customer quote portal.

All routes are protected by the quote's access_token (included in the URL).
The customer never needs to log in — the token IS the credential.
"""
import base64
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.quote import Quote, QuoteStatus
from app.models.deal import Deal
from app.models.account import Account
from app.models.activity import Activity, ActivityType, RelatedToType
from app.models.settings import SystemSetting
import app.services.storage as storage_svc

router = APIRouter(prefix="/portal", tags=["portal"])

QUOTE_TEMPLATE_KEY = "quote_template"

_DEFAULT_TPL = {
    "company_name": "Company",
    "company_address": "",
    "company_email": "",
    "company_phone": "",
    "brand_color": "#e63329",
    "logo_url": None,
    "footer_text": "This quote is valid for {validity_days} days from date of issue.",
    "show_vat_note": True,
    "sections": [],
}


async def _get_quote_by_token(token: str, db: AsyncSession) -> Quote:
    result = await db.execute(select(Quote).where(Quote.access_token == token))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote link is invalid or expired")
    return quote


async def _load_template(db: AsyncSession) -> dict:
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == QUOTE_TEMPLATE_KEY)
    )
    row = result.scalar_one_or_none()
    if row:
        try:
            return {**_DEFAULT_TPL, **json.loads(row.value)}
        except Exception:
            pass
    return dict(_DEFAULT_TPL)


async def _logo_data_url(logo_url: str | None) -> str | None:
    """Return a base64 data URI for the company logo so the portal page can
    render it without requiring any auth header."""
    if not logo_url:
        return None
    filename = logo_url.rstrip("/").split("/")[-1]
    if not filename:
        return None
    try:
        data = await storage_svc.download("logos", filename)
        if not data:
            return None
        ext = filename.rsplit(".", 1)[-1].lower()
        mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                "gif": "image/gif", "webp": "image/webp"}.get(ext, "image/png")
        return f"data:{mime};base64,{base64.b64encode(data).decode()}"
    except Exception:
        return None


# ── Response schemas ──────────────────────────────────────────────────────────

class PortalLineItem(BaseModel):
    product: str
    qty: int | float
    unit_price: float
    total: float
    print_colors: str | None = None
    print_technique: str | None = None
    print_size: str | None = None
    image_url: str | None = None


class PortalQuoteOut(BaseModel):
    id: int
    version: int
    status: str
    currency: str
    line_items: list[dict]
    shipping_cost: float
    production_cost: float
    total_value: float
    payment_terms: str | None
    validity_days: int
    notes: str | None
    created_at: datetime
    sent_at: datetime | None
    # Branding
    company_name: str
    company_address: str
    company_email: str
    company_phone: str
    brand_color: str
    logo_data_url: str | None
    footer_text: str
    show_vat_note: bool
    # Recipient
    account_name: str | None
    account_address: str | None


class ApproveRequest(BaseModel):
    accepted_tnc: bool


class RequestChangeRequest(BaseModel):
    comment: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/quotes/{token}", response_model=PortalQuoteOut)
async def get_portal_quote(token: str, db: AsyncSession = Depends(get_db)):
    quote = await _get_quote_by_token(token, db)
    tpl = await _load_template(db)
    logo_data_url = await _logo_data_url(tpl.get("logo_url"))

    account_name: str | None = None
    account_address: str | None = None
    deal_result = await db.execute(select(Deal).where(Deal.id == quote.deal_id))
    deal = deal_result.scalar_one_or_none()
    if deal and deal.account_id:
        acc_result = await db.execute(select(Account).where(Account.id == deal.account_id))
        acc = acc_result.scalar_one_or_none()
        if acc:
            account_name = acc.name
            account_address = getattr(acc, "address", None)

    return PortalQuoteOut(
        id=quote.id,
        version=quote.version,
        status=quote.status.value,
        currency=quote.currency,
        line_items=quote.line_items or [],
        shipping_cost=float(quote.shipping_cost),
        production_cost=float(quote.production_cost),
        total_value=float(quote.total_value),
        payment_terms=quote.payment_terms,
        validity_days=quote.validity_days,
        notes=quote.notes,
        created_at=quote.created_at,
        sent_at=quote.sent_at,
        company_name=tpl.get("company_name", ""),
        company_address=tpl.get("company_address", ""),
        company_email=tpl.get("company_email", ""),
        company_phone=tpl.get("company_phone", ""),
        brand_color=tpl.get("brand_color", "#e63329"),
        logo_data_url=logo_data_url,
        footer_text=tpl.get("footer_text", ""),
        show_vat_note=tpl.get("show_vat_note", True),
        account_name=account_name,
        account_address=account_address,
    )


@router.post("/quotes/{token}/approve", response_model=dict)
async def approve_quote(
    token: str,
    body: ApproveRequest,
    db: AsyncSession = Depends(get_db),
):
    if not body.accepted_tnc:
        raise HTTPException(status_code=400, detail="Terms and conditions must be accepted")

    quote = await _get_quote_by_token(token, db)
    if quote.status not in (QuoteStatus.sent, QuoteStatus.negotiating):
        raise HTTPException(
            status_code=409,
            detail=f"Quote cannot be approved in its current state ({quote.status.value})",
        )

    quote.status = QuoteStatus.accepted
    quote.accepted_at = datetime.now(timezone.utc)

    db.add(Activity(
        type=ActivityType.note,
        related_to_type=RelatedToType.deal,
        related_to_id=quote.deal_id,
        subject=f"Customer approved Quote #{quote.id} v{quote.version}",
        body="Customer accepted the quote and agreed to the terms and conditions.",
    ))

    return {"status": "accepted"}


@router.post("/quotes/{token}/request-change", response_model=dict)
async def request_change(
    token: str,
    body: RequestChangeRequest,
    db: AsyncSession = Depends(get_db),
):
    comment = (body.comment or "").strip()
    if not comment:
        raise HTTPException(status_code=400, detail="Comment is required")

    quote = await _get_quote_by_token(token, db)
    if quote.status not in (QuoteStatus.sent, QuoteStatus.negotiating):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot request changes for a quote in state ({quote.status.value})",
        )

    quote.status = QuoteStatus.negotiating

    db.add(Activity(
        type=ActivityType.note,
        related_to_type=RelatedToType.deal,
        related_to_id=quote.deal_id,
        subject=f"Customer requested changes to Quote #{quote.id} v{quote.version}",
        body=comment,
    ))

    return {"status": "negotiating"}
