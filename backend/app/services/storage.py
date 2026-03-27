"""
Storage abstraction – local filesystem (dev) or Supabase Storage (prod).

Set SUPABASE_URL + SUPABASE_SERVICE_KEY in the environment to enable
Supabase Storage. Without those vars the service falls back to the
local uploads/ directory so local development needs no changes.
"""
import os
import httpx

_LOCAL_BASE = os.environ.get(
    "UPLOAD_DIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads"),
)

_supabase_client = None


def _sb():
    global _supabase_client
    if _supabase_client is None:
        from app.config import settings
        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY:
            from supabase import create_client
            _supabase_client = create_client(
                settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY
            )
    return _supabase_client


def is_supabase() -> bool:
    from app.config import settings
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY)


async def upload(bucket: str, path: str, content: bytes, mime: str) -> str:
    """Upload *content* to *bucket/path* and return the URL used to access it.

    Always returns an internal API path (not a Supabase CDN URL) so that:
    - auth is enforced regardless of bucket visibility settings
    - logos/thumbnails work identically in local and Supabase modes
    """
    sb = _sb()
    if sb:
        sb.storage.from_(bucket).upload(
            path, content, {"content-type": mime, "upsert": "true"}
        )
        # Return backend-served paths, not CDN URLs — CDN URLs only work for
        # public buckets and bypass our JWT auth on <img src> loads.
        if bucket == "logos":
            return f"/api/v1/settings/quote-template/logo/{path}"
        # attachments / thumbnails are served via /uploads/* endpoints
        return f"/api/v1/uploads/{bucket}/{path}"
    # Local fallback
    dest_dir = os.path.join(_LOCAL_BASE, bucket)
    os.makedirs(dest_dir, exist_ok=True)
    with open(os.path.join(dest_dir, path), "wb") as f:
        f.write(content)
    return f"/api/v1/settings/quote-template/logo/{path}" if bucket == "logos" else f"/api/v1/uploads/{bucket}/{path}"


async def download(bucket: str, path: str) -> bytes | None:
    """Return the raw bytes of *bucket/path*, or None if not found."""
    sb = _sb()
    if sb:
        try:
            return sb.storage.from_(bucket).download(path)
        except Exception as exc:
            print(f"[storage] download failed bucket={bucket!r} path={path!r}: {exc}")
            return None
    local_path = os.path.join(_LOCAL_BASE, bucket, path)
    if os.path.exists(local_path):
        with open(local_path, "rb") as f:
            return f.read()
    return None


async def delete(bucket: str, path: str) -> None:
    """Delete *bucket/path* (best-effort; ignores errors)."""
    sb = _sb()
    if sb:
        try:
            sb.storage.from_(bucket).remove([path])
        except Exception:
            pass
        return
    local_path = os.path.join(_LOCAL_BASE, bucket, path)
    if os.path.exists(local_path):
        os.remove(local_path)


async def fetch_url(url: str) -> bytes | None:
    """Fetch raw bytes from an arbitrary URL (used by pdf_generator for logos)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
            r.raise_for_status()
            return r.content
    except Exception:
        return None
