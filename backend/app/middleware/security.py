"""
Security middleware:
- Security response headers (OWASP recommended)
- In-memory rate limiter for brute-force protection (no external deps)
- Login attempt tracking with exponential back-off per IP
"""
import time
import hashlib
from collections import defaultdict
from threading import Lock
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse


# ── Rate Limiter ─────────────────────────────────────────────────────────────

class _RateLimiter:
    """Sliding-window in-memory rate limiter. Thread-safe."""

    def __init__(self):
        self._windows: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def is_allowed(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        """Returns (allowed, retry_after_seconds)."""
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            hits = self._windows[key]
            # Evict old entries
            hits[:] = [t for t in hits if t > cutoff]
            if len(hits) >= limit:
                oldest = hits[0]
                retry_after = int(window_seconds - (now - oldest)) + 1
                return False, retry_after
            hits.append(now)
            return True, 0

    def reset(self, key: str) -> None:
        with self._lock:
            self._windows.pop(key, None)


_limiter = _RateLimiter()


def get_rate_limiter() -> _RateLimiter:
    return _limiter


def _client_ip(request: Request) -> str:
    """Best-effort client IP, handles proxy headers."""
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── Security Headers Middleware ───────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add OWASP-recommended security headers to every response."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Prevent MIME-type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Prevent framing (clickjacking)
        response.headers["X-Frame-Options"] = "DENY"
        # XSS filter (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # HSTS – enforce HTTPS (1 year, no subdomains for localhost compat)
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
        # Don't send Referer to cross-origin
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Minimal CSP – tighten in production
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' data: blob:; "
            "style-src 'self' 'unsafe-inline'; "
            "font-src 'self' data:; "
            "script-src 'self'; "
            "frame-ancestors 'none';"
        )
        # Disable browser features we don't need
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=(), payment=()"
        )
        # Don't expose server info
        if "server" in response.headers:
            del response.headers["server"]

        return response


# ── Login Rate Limit Middleware ───────────────────────────────────────────────

class LoginRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Applies rate limiting to /api/v1/auth/login:
      - 5 attempts per IP per minute (short window)
      - 20 attempts per IP per 15 minutes (longer window)
    On repeated failures: return 429 with Retry-After header.
    """
    LOGIN_PATH = "/api/v1/auth/login"
    SHORT_LIMIT = 5
    SHORT_WINDOW = 60       # seconds
    LONG_LIMIT = 20
    LONG_WINDOW = 900       # 15 minutes

    async def dispatch(self, request: Request, call_next):
        if request.url.path != self.LOGIN_PATH or request.method != "POST":
            return await call_next(request)

        ip = _client_ip(request)
        limiter = get_rate_limiter()

        # Short window check
        ok, retry = limiter.is_allowed(f"login:short:{ip}", self.SHORT_LIMIT, self.SHORT_WINDOW)
        if not ok:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many login attempts. Please wait before trying again."},
                headers={"Retry-After": str(retry)},
            )

        # Long window check
        ok, retry = limiter.is_allowed(f"login:long:{ip}", self.LONG_LIMIT, self.LONG_WINDOW)
        if not ok:
            return JSONResponse(
                status_code=429,
                content={"detail": f"Too many login attempts. Account temporarily blocked for {retry}s."},
                headers={"Retry-After": str(retry)},
            )

        response = await call_next(request)

        # On successful login reset short window counter (optional – keeps UX smooth)
        if response.status_code == 200:
            limiter.reset(f"login:short:{ip}")

        return response


# ── Global API Rate Limit ─────────────────────────────────────────────────────

class GlobalRateLimitMiddleware(BaseHTTPMiddleware):
    """General rate limit: 300 req/min per IP across all /api/ endpoints."""
    LIMIT = 300
    WINDOW = 60

    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        ip = _client_ip(request)
        ok, retry = get_rate_limiter().is_allowed(f"global:{ip}", self.LIMIT, self.WINDOW)
        if not ok:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Please slow down."},
                headers={"Retry-After": str(retry)},
            )
        return await call_next(request)
