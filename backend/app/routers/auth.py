import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserOut
from app.services.auth_service import get_current_user, create_access_token
from app.services.azure_token import validate_azure_token, extract_crm_role

router = APIRouter(prefix="/auth", tags=["auth"])

_AZURE_AUTH_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize"
_AZURE_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"


def _make_state() -> str:
    """Signed, short-lived state token to prevent CSRF on the callback."""
    nonce = secrets.token_urlsafe(16)
    return jwt.encode(
        {"n": nonce, "exp": datetime.now(timezone.utc) + timedelta(minutes=10)},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def _verify_state(state: str | None) -> None:
    if not state:
        raise HTTPException(status_code=400, detail="Missing state parameter")
    try:
        jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired state")


@router.get("/login")
async def login():
    """Redirect browser to Azure AD login (confidential client, Web platform)."""
    params = {
        "client_id": settings.AZURE_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": settings.AZURE_REDIRECT_URI,
        "response_mode": "query",
        "scope": "openid profile email",
        "state": _make_state(),
    }
    url = _AZURE_AUTH_URL.format(tenant=settings.AZURE_TENANT_ID) + "?" + urlencode(params)
    return RedirectResponse(url)


@router.get("/callback")
async def callback(
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
    error_description: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Azure AD redirects here after login. Exchange code → CRM JWT → redirect to frontend."""
    if error:
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error={error}")

    _verify_state(state)

    # Exchange authorization code for tokens (confidential client – uses client secret)
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            _AZURE_TOKEN_URL.format(tenant=settings.AZURE_TENANT_ID),
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.AZURE_REDIRECT_URI,
                "client_id": settings.AZURE_CLIENT_ID,
                "client_secret": settings.AZURE_CLIENT_SECRET,
                "scope": "openid profile email",
            },
        )

    token_data = resp.json()
    id_token_str = token_data.get("id_token")
    if not id_token_str:
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=token_exchange_failed")

    try:
        claims = validate_azure_token(id_token_str)
    except Exception:
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=invalid_token")

    oid: str | None = claims.get("oid")
    if not oid:
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=missing_oid")

    roles_claim: list[str] = claims.get("roles", [])
    crm_role = extract_crm_role(roles_claim)
    if crm_role is None:
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=no_crm_role")

    # Look up by Entra OID, fall back to email match for pre-created accounts
    result = await db.execute(select(User).where(User.entra_object_id == oid))
    user = result.scalar_one_or_none()

    if user is None:
        email = claims.get("email") or claims.get("preferred_username") or f"{oid}@unknown"
        pre = await db.execute(select(User).where(User.email == email))
        user = pre.scalar_one_or_none()
        if user:
            user.entra_object_id = oid
        else:
            user = User(
                entra_object_id=oid,
                email=email,
                full_name=claims.get("name") or email,
                role=UserRole(crm_role),
                is_active=True,
            )
            db.add(user)
            await db.flush()
    elif not user.is_active:
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=account_inactive")
    else:
        user.role = UserRole(crm_role)

    crm_token = create_access_token({"sub": str(user.id)})
    return RedirectResponse(f"{settings.FRONTEND_URL}/auth/callback?token={crm_token}")


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
