from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import os
import uuid
import secrets

from app.database import get_db
from app.models.quote import Quote, QuoteStatus
from app.models.deal import Deal
from app.models.user import User
from app.schemas.quote import QuoteCreate, QuoteUpdate, QuoteOut
from app.services.auth_service import get_current_user
from app.services.quote_service import create_quote_version, calculate_total
from app.reports.pdf_generator import generate_quote_pdf
from app.routers.uploads import _auth_from_request, UPLOAD_DIR, MAX_FILE_SIZE, _validate_magic_bytes

router = APIRouter(prefix="/quotes", tags=["quotes"])


@router.get("", response_model=list[QuoteOut])
async def list_quotes(
    deal_id: Optional[int] = None,
    status: Optional[str] = None,
    created_after: Optional[datetime] = None,
    created_before: Optional[datetime] = None,
    skip: int = 0,
    limit: int = Query(50, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Quote)
    if deal_id:
        q = q.where(Quote.deal_id == deal_id)
    if status:
        q = q.where(Quote.status == status)
    if created_after:
        q = q.where(Quote.created_at >= created_after)
    if created_before:
        q = q.where(Quote.created_at <= created_before)
    result = await db.execute(q.order_by(Quote.created_at.desc()).offset(skip).limit(limit))
    return result.scalars().all()


@router.post("", response_model=QuoteOut, status_code=status.HTTP_201_CREATED)
async def create_quote(
    payload: QuoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deal_result = await db.execute(select(Deal).where(Deal.id == payload.deal_id))
    deal = deal_result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail=f"Deal #{payload.deal_id} not found")
    quote = await create_quote_version(payload, db)
    deal.quote_id = quote.id
    return quote


@router.get("/{quote_id}", response_model=QuoteOut)
async def get_quote(
    quote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Quote).where(Quote.id == quote_id))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote


@router.patch("/{quote_id}", response_model=QuoteOut)
async def update_quote(
    quote_id: int,
    payload: QuoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Quote).where(Quote.id == quote_id))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    if quote.status not in (QuoteStatus.draft, QuoteStatus.negotiating):
        raise HTTPException(status_code=400, detail="Only draft/negotiating quotes can be edited")
    data = payload.model_dump(exclude_none=True)
    if "line_items" in data:
        data["line_items"] = [item.model_dump() if hasattr(item, "model_dump") else item for item in data["line_items"]]
    for field, value in data.items():
        setattr(quote, field, value)
    # Recalculate total
    quote.total_value = await calculate_total(
        quote.line_items,
        float(quote.shipping_cost),
        float(quote.production_cost),
    )
    return quote


@router.post("/{quote_id}/send", response_model=QuoteOut)
async def send_quote(
    quote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Quote).where(Quote.id == quote_id))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    if not quote.access_token:
        quote.access_token = secrets.token_urlsafe(32)
    quote.status = QuoteStatus.sent
    quote.sent_at = datetime.now(timezone.utc)
    # Advance deal to quote_sent stage
    deal_result = await db.execute(select(Deal).where(Deal.id == quote.deal_id))
    deal = deal_result.scalar_one_or_none()
    if deal and deal.stage == "quote_preparation":
        deal.stage = "quote_sent"
    return quote


@router.post("/{quote_id}/accept", response_model=QuoteOut)
async def accept_quote(
    quote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Quote).where(Quote.id == quote_id))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    quote.status = QuoteStatus.accepted
    quote.accepted_at = datetime.now(timezone.utc)
    return quote


@router.post("/images")
async def upload_quote_image(
    deal_id: int = Query(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")
    mime = (file.content_type or "").lower().split(";")[0].strip()
    _validate_magic_bytes(content, mime, file.filename or "upload")
    folder = os.path.join(UPLOAD_DIR, "quotes", str(deal_id))
    os.makedirs(folder, exist_ok=True)
    ext = os.path.splitext(file.filename or "img")[-1].lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(folder, filename), "wb") as fh:
        fh.write(content)
    return {"url": f"/api/v1/quotes/images/{deal_id}/{filename}"}


@router.get("/images/{deal_id}/{filename}")
async def serve_quote_image(
    deal_id: int,
    filename: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await _auth_from_request(request, db)
    path = os.path.join(UPLOAD_DIR, "quotes", str(deal_id), filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)


@router.get("/{quote_id}/pdf")
async def download_quote_pdf(
    quote_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await _auth_from_request(request, db)
    result = await db.execute(select(Quote).where(Quote.id == quote_id))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    pdf_bytes = await generate_quote_pdf(quote, db)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=quote_{quote.id}_v{quote.version}.pdf"},
    )
