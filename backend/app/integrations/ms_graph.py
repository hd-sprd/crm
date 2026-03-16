"""
Microsoft Graph / Azure AD Integration.

OAuth2 flow:
  1. GET  /api/v1/integrations/ms-graph/authorize  → redirects user to Microsoft login
  2. GET  /api/v1/integrations/ms-graph/callback   → exchanges code for token, stores in DB
  3. Backend uses stored token to call Graph API endpoints

Required Azure AD App Registration settings:
  - Application (client) ID  → AZURE_CLIENT_ID
  - Directory (tenant) ID    → AZURE_TENANT_ID
  - Client secret            → AZURE_CLIENT_SECRET
  - Redirect URI             → AZURE_REDIRECT_URI
  - API Permissions: Mail.ReadWrite, Calendars.ReadWrite, User.Read
"""

import msal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/integrations/ms-graph", tags=["ms-graph"])


def _build_msal_app(cache=None) -> msal.ConfidentialClientApplication:
    if not settings.AZURE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Microsoft Graph integration not configured")
    return msal.ConfidentialClientApplication(
        client_id=settings.AZURE_CLIENT_ID,
        authority=f"https://login.microsoftonline.com/{settings.AZURE_TENANT_ID}",
        client_credential=settings.AZURE_CLIENT_SECRET,
        token_cache=cache,
    )


@router.get("/authorize")
async def ms_graph_authorize(current_user: User = Depends(get_current_user)):
    """Redirect the user to Microsoft's OAuth2 login page."""
    app = _build_msal_app()
    auth_url = app.get_authorization_request_url(
        scopes=settings.AZURE_SCOPES,
        redirect_uri=settings.AZURE_REDIRECT_URI,
        state=str(current_user.id),
    )
    return RedirectResponse(url=auth_url)


@router.get("/callback")
async def ms_graph_callback(
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
):
    """Exchange authorization code for tokens and store them."""
    app = _build_msal_app()
    result = app.acquire_token_by_authorization_code(
        code=code,
        scopes=settings.AZURE_SCOPES,
        redirect_uri=settings.AZURE_REDIRECT_URI,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result.get("error_description", "OAuth error"))

    user_id = int(state)
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.ms_graph_token = result.get("access_token")
    user.ms_graph_refresh_token = result.get("refresh_token")
    expires_in = result.get("expires_in", 3600)
    user.ms_graph_token_expiry = datetime.now(timezone.utc).replace(second=0, microsecond=0)

    await db.commit()
    frontend_url = settings.FRONTEND_URL.rstrip("/")
    return RedirectResponse(url=f"{frontend_url}/admin?outlook=connected", status_code=302)


@router.delete("/disconnect")
async def ms_graph_disconnect(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove stored Graph tokens from user account."""
    current_user.ms_graph_token = None
    current_user.ms_graph_refresh_token = None
    current_user.ms_graph_token_expiry = None
    await db.commit()
    return {"message": "Microsoft Graph disconnected"}


@router.get("/status")
async def ms_graph_status(current_user: User = Depends(get_current_user)):
    """Check if the current user has a valid Graph connection."""
    connected = bool(current_user.ms_graph_token)
    expired = False
    if current_user.ms_graph_token_expiry:
        expired = datetime.now(timezone.utc) > current_user.ms_graph_token_expiry
    return {
        "connected": connected and not expired,
        "token_expiry": current_user.ms_graph_token_expiry,
    }


# ──────────────────────────────────────────────
# Graph API helper functions (used by other routers)
# ──────────────────────────────────────────────

import httpx


async def _get_valid_token(user: User, db: AsyncSession) -> str:
    """Return a valid access token, refreshing if necessary."""
    if not user.ms_graph_token:
        raise HTTPException(status_code=403, detail="Microsoft Graph not connected. Visit /integrations/ms-graph/authorize")

    now = datetime.now(timezone.utc)
    if user.ms_graph_token_expiry and now >= user.ms_graph_token_expiry:
        # Refresh token
        app = _build_msal_app()
        result = app.acquire_token_by_refresh_token(
            refresh_token=user.ms_graph_refresh_token,
            scopes=settings.AZURE_SCOPES,
        )
        if "error" in result:
            raise HTTPException(status_code=403, detail="Graph token refresh failed. Re-authorize.")
        user.ms_graph_token = result["access_token"]
        if result.get("refresh_token"):
            user.ms_graph_refresh_token = result["refresh_token"]
        await db.commit()

    return user.ms_graph_token


async def list_emails(user: User, db: AsyncSession, folder: str = "inbox", top: int = 25) -> list[dict]:
    """Fetch recent emails from the user's mailbox via Graph API."""
    token = await _get_valid_token(user, db)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://graph.microsoft.com/v1.0/me/mailFolders/{folder}/messages",
            params={"$top": top, "$orderby": "receivedDateTime desc"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
    return resp.json().get("value", [])


async def send_email(user: User, db: AsyncSession, to: str, subject: str, body: str) -> dict:
    """Send an email via Graph API on behalf of the user."""
    token = await _get_valid_token(user, db)
    payload = {
        "message": {
            "subject": subject,
            "body": {"contentType": "Text", "content": body},
            "toRecipients": [{"emailAddress": {"address": to}}],
        },
        "saveToSentItems": True,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://graph.microsoft.com/v1.0/me/sendMail",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        resp.raise_for_status()
    return {"sent": True}
