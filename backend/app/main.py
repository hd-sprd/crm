from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.config import settings as cfg
from app.routers import auth, users, accounts, contacts, leads, deals, quotes, activities, tasks, reports
from app.routers import settings as settings_router
from app.routers import uploads, import_data, gdpr, audit_log as audit_log_router
from app.routers import search, notifications as notifications_router, saved_views as saved_views_router
from app.integrations import ms_graph
from app.middleware.security import (
    SecurityHeadersMiddleware,
    LoginRateLimitMiddleware,
    GlobalRateLimitMiddleware,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title=cfg.APP_NAME,
    version=cfg.APP_VERSION,
    # Disable docs in production (set DEBUG=false in .env)
    docs_url="/api/docs" if cfg.DEBUG else None,
    redoc_url="/api/redoc" if cfg.DEBUG else None,
    openapi_url="/api/openapi.json" if cfg.DEBUG else None,
    lifespan=lifespan,
    redirect_slashes=False,
)

# ── Middleware (outermost first) ──────────────────────────────────────────────

# 1. Trusted hosts – prevent host header injection
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.spreadshirt.com", "*"],  # tighten in prod
)

# 2. CORS – explicit origins, no wildcard in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=cfg.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID"],
    expose_headers=["Content-Disposition", "Retry-After"],
)

# 3. Security headers on every response
app.add_middleware(SecurityHeadersMiddleware)

# 4. Brute-force protection on login
app.add_middleware(LoginRateLimitMiddleware)

# 5. General API rate limit
app.add_middleware(GlobalRateLimitMiddleware)

# ── Routers ───────────────────────────────────────────────────────────────────

PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(users.router, prefix=PREFIX)
app.include_router(accounts.router, prefix=PREFIX)
app.include_router(contacts.router, prefix=PREFIX)
app.include_router(leads.router, prefix=PREFIX)
app.include_router(deals.router, prefix=PREFIX)
app.include_router(quotes.router, prefix=PREFIX)
app.include_router(activities.router, prefix=PREFIX)
app.include_router(tasks.router, prefix=PREFIX)
app.include_router(reports.router, prefix=PREFIX)
app.include_router(settings_router.router, prefix=PREFIX)
app.include_router(uploads.router, prefix=PREFIX)
app.include_router(import_data.router, prefix=PREFIX)
app.include_router(gdpr.router, prefix=PREFIX)
app.include_router(audit_log_router.router, prefix=PREFIX)
app.include_router(search.router, prefix=PREFIX)
app.include_router(notifications_router.router, prefix=PREFIX)
app.include_router(saved_views_router.router, prefix=PREFIX)
app.include_router(ms_graph.router, prefix=PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "version": cfg.APP_VERSION}
