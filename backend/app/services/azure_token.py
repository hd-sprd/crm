import time
import jwt
from jwt import PyJWKClient

from app.config import settings

_jwks_client: PyJWKClient | None = None
_jwks_client_ts: float = 0
_JWKS_TTL = 3600


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client, _jwks_client_ts
    now = time.monotonic()
    if _jwks_client is None or (now - _jwks_client_ts) > _JWKS_TTL:
        url = (
            f"https://login.microsoftonline.com/"
            f"{settings.AZURE_TENANT_ID}/discovery/v2.0/keys"
        )
        _jwks_client = PyJWKClient(url, cache_jwk_set=True, lifespan=_JWKS_TTL)
        _jwks_client_ts = now
    return _jwks_client


def validate_azure_token(token: str) -> dict:
    """Validate an Azure AD access token; return the decoded claims."""
    client = _get_jwks_client()
    signing_key = client.get_signing_key_from_jwt(token)
    issuer = f"https://login.microsoftonline.com/{settings.AZURE_TENANT_ID}/v2.0"

    # Try api:// audience first (access token for custom API), then bare client_id
    for audience in (f"api://{settings.AZURE_CLIENT_ID}", settings.AZURE_CLIENT_ID):
        try:
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=audience,
                issuer=issuer,
            )
        except jwt.InvalidAudienceError:
            continue

    raise jwt.InvalidAudienceError("Token audience does not match configured client_id")


# Precedence order: highest privilege first
_ROLE_PRECEDENCE = ["admin", "sales_manager", "account_manager", "sales_rep"]


def extract_crm_role(roles_claim: list[str]) -> str | None:
    """Map Azure App Role values → CRM role, highest privilege wins."""
    claim_map = {
        settings.AZURE_ROLE_ADMIN: "admin",
        settings.AZURE_ROLE_SALES_MANAGER: "sales_manager",
        settings.AZURE_ROLE_ACCOUNT_MANAGER: "account_manager",
        settings.AZURE_ROLE_SALES_REP: "sales_rep",
    }
    for crm_role in _ROLE_PRECEDENCE:
        for claim_value, mapped in claim_map.items():
            if mapped == crm_role and claim_value in roles_claim:
                return crm_role
    return None
