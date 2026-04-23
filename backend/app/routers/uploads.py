import asyncio
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Request
from fastapi.responses import FileResponse, Response, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from typing import Optional
from app.config import settings as cfg
from app.database import get_db
from app.models.attachment import Attachment
from app.models.user import User
from app.services.auth_service import get_current_user
from app.services.azure_token import validate_azure_token
import app.services.storage as storage_svc

router = APIRouter(prefix="/uploads", tags=["uploads"])

UPLOAD_DIR = os.environ.get(
    "UPLOAD_DIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads"),
)
THUMB_DIR = os.path.join(UPLOAD_DIR, "thumbnails")
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(THUMB_DIR, exist_ok=True)
except OSError:
    pass  # read-only filesystem (e.g. Vercel) – Supabase Storage is used in production

IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

# Magic-bytes signatures per MIME type
_MAGIC: dict[str, list[bytes]] = {
    "image/jpeg":       [b"\xff\xd8\xff"],
    "image/png":        [b"\x89PNG\r\n\x1a\n"],
    "image/gif":        [b"GIF87a", b"GIF89a"],
    "image/webp":       [b"RIFF"],
    "application/pdf":  [b"%PDF-"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [b"PK\x03\x04"],
    "application/vnd.ms-excel": [b"\xd0\xcf\x11\xe0"],
    "text/csv":         [],  # no magic bytes – validated via extension only
}
ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".pdf", ".xlsx", ".xls", ".csv",
}


def _validate_magic_bytes(content: bytes, declared_mime: str, filename: str) -> str:
    """Check file magic bytes against declared MIME type. Returns the normalised MIME."""
    ext = os.path.splitext(filename.lower())[-1] if filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"File extension not allowed: {ext or 'unknown'}")

    mime = declared_mime.lower().split(";")[0].strip()
    if mime == "image/jpg":
        mime = "image/jpeg"

    if mime not in _MAGIC:
        raise HTTPException(status_code=415, detail=f"MIME type not allowed: {mime}")

    sigs = _MAGIC[mime]
    if sigs and not any(content[: len(s)] == s for s in sigs):
        raise HTTPException(
            status_code=415,
            detail="File content does not match declared type (magic bytes mismatch)",
        )
    # Extra WebP sanity: bytes 8-12 must be b"WEBP"
    if mime == "image/webp" and len(content) >= 12 and content[8:12] != b"WEBP":
        raise HTTPException(status_code=415, detail="Invalid WebP file")

    return mime


class AttachmentOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    original_name: str
    stored_name: str
    mime_type: str
    file_size: int
    has_thumbnail: bool
    uploaded_by: Optional[int]
    # Pre-signed Supabase CDN URLs (1 h expiry). Present when Supabase
    # storage is active — the frontend uses them directly so no N+1
    # backend round-trips are needed per thumbnail/file.
    file_url: Optional[str] = None
    thumb_url: Optional[str] = None
    model_config = {"from_attributes": True}


def _extract_token(request: Request) -> str:
    token = request.query_params.get("token") or ""
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return token


async def _auth_from_request(request: Request, db: AsyncSession) -> User:
    """Accept Azure AD token from Authorization header OR ?token= query param (needed for <img src>)."""
    token = _extract_token(request)
    try:
        claims = validate_azure_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    oid = claims.get("oid")
    if not oid:
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await db.execute(select(User).where(User.entra_object_id == oid))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _verify_token(request: Request) -> None:
    """Validate Azure AD token signature + expiry only — no DB lookup."""
    token = _extract_token(request)
    try:
        validate_azure_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def _make_thumbnail_bytes(content: bytes) -> bytes | None:
    try:
        import io
        from PIL import Image
        with Image.open(io.BytesIO(content)) as img:
            img.thumbnail((300, 300))
            img = img.convert("RGB")
            buf = io.BytesIO()
            img.save(buf, "JPEG", quality=85)
            return buf.getvalue()
    except Exception:
        return None


@router.post("", response_model=AttachmentOut, status_code=201)
async def upload_file(
    entity_type: str = Query(...),
    entity_id: int = Query(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if entity_type not in ("deal", "lead", "contact", "account"):
        raise HTTPException(status_code=400, detail="Invalid entity_type")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")

    mime = _validate_magic_bytes(
        content,
        file.content_type or "application/octet-stream",
        file.filename or "",
    )

    ext = os.path.splitext(file.filename or "")[-1].lower()
    stored_name = f"{uuid.uuid4()}{ext}"

    await storage_svc.upload("attachments", stored_name, content, mime)

    has_thumb = False
    if mime in IMAGE_MIME_TYPES:
        thumb_bytes = _make_thumbnail_bytes(content)
        if thumb_bytes is not None:
            await storage_svc.upload("thumbnails", stored_name + ".jpg", thumb_bytes, "image/jpeg")
            has_thumb = True

    attachment = Attachment(
        entity_type=entity_type,
        entity_id=entity_id,
        original_name=file.filename or stored_name,
        stored_name=stored_name,
        mime_type=mime,
        file_size=len(content),
        has_thumbnail=has_thumb,
        uploaded_by=current_user.id,
    )
    db.add(attachment)
    await db.flush()
    return attachment


@router.get("", response_model=list[AttachmentOut])
async def list_attachments(
    entity_type: str = Query(...),
    entity_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Attachment).where(
            and_(Attachment.entity_type == entity_type, Attachment.entity_id == entity_id)
        ).order_by(Attachment.created_at.desc())
    )
    attachments = result.scalars().all()

    if not storage_svc.is_supabase() or not attachments:
        return list(attachments)

    # Pre-generate 1-hour signed CDN URLs for all attachments in parallel.
    # The supabase-py storage client is synchronous, so we push each call
    # into the default thread-pool executor to avoid blocking the event loop.
    loop = asyncio.get_running_loop()

    async def _sign(bucket: str, path: str) -> Optional[str]:
        return await loop.run_in_executor(
            None, lambda: storage_svc.create_signed_url(bucket, path, 3600)
        )

    async def _none() -> None:
        return None

    file_tasks = [_sign("attachments", att.stored_name) for att in attachments]
    thumb_tasks = [
        _sign("thumbnails", att.stored_name + ".jpg") if att.has_thumbnail
        else _none()
        for att in attachments
    ]

    file_urls = await asyncio.gather(*file_tasks)
    thumb_urls = await asyncio.gather(*thumb_tasks)

    out: list[AttachmentOut] = []
    for att, fu, tu in zip(attachments, file_urls, thumb_urls):
        item = AttachmentOut.model_validate(att)
        item.file_url = fu
        item.thumb_url = tu if att.has_thumbnail else None
        out.append(item)
    return out


@router.get("/{attachment_id}/file")
async def serve_file(
    attachment_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    _verify_token(request)
    result = await db.execute(select(Attachment).where(Attachment.id == attachment_id))
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if storage_svc.is_supabase():
        url = storage_svc.create_signed_url("attachments", att.stored_name)
        if not url:
            raise HTTPException(status_code=404, detail="File not found in storage")
        return RedirectResponse(url=url, status_code=302)
    path = os.path.join(UPLOAD_DIR, "attachments", att.stored_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    if att.mime_type in IMAGE_MIME_TYPES:
        return FileResponse(path, media_type=att.mime_type)
    return FileResponse(path, media_type=att.mime_type, filename=att.original_name)


@router.get("/{attachment_id}/thumb")
async def serve_thumbnail(
    attachment_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    _verify_token(request)
    result = await db.execute(select(Attachment).where(Attachment.id == attachment_id))
    att = result.scalar_one_or_none()
    if not att or not att.has_thumbnail:
        raise HTTPException(status_code=404, detail="Thumbnail not available")
    if storage_svc.is_supabase():
        url = storage_svc.create_signed_url("thumbnails", att.stored_name + ".jpg")
        if not url:
            raise HTTPException(status_code=404, detail="Thumbnail not found in storage")
        return RedirectResponse(url=url, status_code=302)
    thumb_path = os.path.join(THUMB_DIR, att.stored_name + ".jpg")
    if not os.path.exists(thumb_path):
        raise HTTPException(status_code=404, detail="Thumbnail not found on disk")
    return FileResponse(thumb_path, media_type="image/jpeg")


@router.delete("/{attachment_id}", status_code=204)
async def delete_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Attachment).where(Attachment.id == attachment_id))
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    await storage_svc.delete("attachments", att.stored_name)
    await storage_svc.delete("thumbnails", att.stored_name + ".jpg")
    await db.delete(att)
