from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User, UserRole
from app.services.azure_token import validate_azure_token, extract_crm_role

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        claims = validate_azure_token(credentials.credentials)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    oid: str | None = claims.get("oid")
    if not oid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing oid claim")

    result = await db.execute(select(User).where(User.entra_object_id == oid))
    user = result.scalar_one_or_none()

    roles_claim: list[str] = claims.get("roles", [])
    crm_role = extract_crm_role(roles_claim)

    if crm_role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No CRM role assigned. Ask your administrator to assign a role in Azure.",
        )

    if user is None:
        # JIT provisioning: first login → create user record
        email = claims.get("email") or claims.get("preferred_username") or f"{oid}@unknown"
        # Link to a pre-created account by email if the admin provisioned it
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
    else:
        # Sync role from Azure on every request
        user.role = UserRole(crm_role)

    now = datetime.now(timezone.utc)
    if user.last_seen_at is None or (now - user.last_seen_at).total_seconds() > 120:
        user.last_seen_at = now

    return user


def require_roles(*roles):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user
    return role_checker


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
