import os
import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Any, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.settings import SystemSetting, CustomFieldDef
from app.models.workflow import Workflow, WorkflowStage
from app.models.user import User, UserRole
from app.services.auth_service import get_current_user
import app.services.storage as storage_svc

router = APIRouter(prefix="/settings", tags=["settings"])


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ── Workflows ─────────────────────────────────────────────────────────────────

class WorkflowStageCreate(BaseModel):
    key: str
    label_en: str
    label_de: str
    color: str = "blue"
    stage_order: int
    is_won: bool = False
    is_lost: bool = False
    requires_quote: bool = False
    requires_approved_quote: bool = False
    requires_feasibility: bool = False
    requires_artwork: bool = False
    requires_invoice: bool = False


class WorkflowStageUpdate(BaseModel):
    label_en: Optional[str] = None
    label_de: Optional[str] = None
    color: Optional[str] = None
    stage_order: Optional[int] = None
    is_won: Optional[bool] = None
    is_lost: Optional[bool] = None
    is_active: Optional[bool] = None
    requires_quote: Optional[bool] = None
    requires_approved_quote: Optional[bool] = None
    requires_feasibility: Optional[bool] = None
    requires_artwork: Optional[bool] = None
    requires_invoice: Optional[bool] = None


class WorkflowStageOut(BaseModel):
    id: int
    workflow_id: int
    key: str
    label_en: str
    label_de: str
    color: str
    stage_order: int
    is_won: bool
    is_lost: bool
    is_active: bool
    requires_quote: bool
    requires_approved_quote: bool
    requires_feasibility: bool
    requires_artwork: bool
    requires_invoice: bool
    model_config = {"from_attributes": True}


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    quote_approval_target_stage: Optional[str] = None


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    quote_approval_target_stage: Optional[str] = None


class WorkflowOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_default: bool
    quote_approval_target_stage: Optional[str]
    model_config = {"from_attributes": True}


class WorkflowWithStagesOut(WorkflowOut):
    stages: list[WorkflowStageOut] = []


@router.get("/workflows", response_model=list[WorkflowWithStagesOut])
async def list_workflows(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Workflow).order_by(Workflow.is_default.desc(), Workflow.id)
    )
    workflows = result.scalars().unique().all()
    # Ensure stages are loaded
    out = []
    for wf in workflows:
        stages_result = await db.execute(
            select(WorkflowStage)
            .where(WorkflowStage.workflow_id == wf.id)
            .order_by(WorkflowStage.stage_order)
        )
        wf_dict = WorkflowOut.model_validate(wf).model_dump()
        wf_dict["stages"] = [WorkflowStageOut.model_validate(s) for s in stages_result.scalars().all()]
        out.append(wf_dict)
    return out


@router.post("/workflows", response_model=WorkflowWithStagesOut, status_code=201)
async def create_workflow(
    payload: WorkflowCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    wf = Workflow(**payload.model_dump(), is_default=False)
    db.add(wf)
    await db.flush()
    return {**WorkflowOut.model_validate(wf).model_dump(), "stages": []}


@router.get("/workflows/{workflow_id}", response_model=WorkflowWithStagesOut)
async def get_workflow(
    workflow_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    stages_result = await db.execute(
        select(WorkflowStage)
        .where(WorkflowStage.workflow_id == wf.id)
        .order_by(WorkflowStage.stage_order)
    )
    wf_dict = WorkflowOut.model_validate(wf).model_dump()
    wf_dict["stages"] = [WorkflowStageOut.model_validate(s) for s in stages_result.scalars().all()]
    return wf_dict


@router.patch("/workflows/{workflow_id}", response_model=WorkflowOut)
async def update_workflow(
    workflow_id: int,
    payload: WorkflowUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(wf, k, v)
    return wf


@router.delete("/workflows/{workflow_id}", status_code=204)
async def delete_workflow(
    workflow_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if wf.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default workflow")
    await db.delete(wf)


@router.get("/workflows/{workflow_id}/stages", response_model=list[WorkflowStageOut])
async def list_workflow_stages(
    workflow_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WorkflowStage)
        .where(WorkflowStage.workflow_id == workflow_id)
        .order_by(WorkflowStage.stage_order)
    )
    return result.scalars().all()


@router.post("/workflows/{workflow_id}/stages", response_model=WorkflowStageOut, status_code=201)
async def create_workflow_stage(
    workflow_id: int,
    payload: WorkflowStageCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    wf_result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    if not wf_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Workflow not found")
    existing = await db.execute(
        select(WorkflowStage).where(
            WorkflowStage.workflow_id == workflow_id, WorkflowStage.key == payload.key
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Stage key already exists in this workflow")
    stage = WorkflowStage(workflow_id=workflow_id, **payload.model_dump())
    db.add(stage)
    await db.flush()
    return stage


@router.patch("/workflow-stages/{stage_id}", response_model=WorkflowStageOut)
async def update_workflow_stage(
    stage_id: int,
    payload: WorkflowStageUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(WorkflowStage).where(WorkflowStage.id == stage_id))
    stage = result.scalar_one_or_none()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(stage, k, v)
    return stage


@router.delete("/workflow-stages/{stage_id}", status_code=204)
async def delete_workflow_stage(
    stage_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(WorkflowStage).where(WorkflowStage.id == stage_id))
    stage = result.scalar_one_or_none()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    await db.delete(stage)


@router.post("/workflows/{workflow_id}/stages/reorder", response_model=list[WorkflowStageOut])
async def reorder_workflow_stages(
    workflow_id: int,
    order: list[dict],  # [{id: 1, stage_order: 0}, ...]
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    for item in order:
        result = await db.execute(
            select(WorkflowStage).where(
                WorkflowStage.id == item["id"], WorkflowStage.workflow_id == workflow_id
            )
        )
        stage = result.scalar_one_or_none()
        if stage:
            stage.stage_order = item["stage_order"]
    result = await db.execute(
        select(WorkflowStage)
        .where(WorkflowStage.workflow_id == workflow_id)
        .order_by(WorkflowStage.stage_order)
    )
    return result.scalars().all()


# ── Custom Field Definitions ──────────────────────────────────────────────────

class CustomFieldDefCreate(BaseModel):
    name: str
    label_en: str
    label_de: str
    field_type: str  # text, number, date, select, checkbox
    applies_to: str  # deal, lead, contact
    options: Optional[list[str]] = None
    is_required: bool = False
    field_order: int = 0


class CustomFieldDefUpdate(BaseModel):
    label_en: Optional[str] = None
    label_de: Optional[str] = None
    options: Optional[list[str]] = None
    is_required: Optional[bool] = None
    field_order: Optional[int] = None
    is_active: Optional[bool] = None


class CustomFieldDefOut(BaseModel):
    id: int
    name: str
    label_en: str
    label_de: str
    field_type: str
    applies_to: str
    options: Optional[list[str]]
    is_required: bool
    field_order: int
    is_active: bool
    model_config = {"from_attributes": True}


@router.get("/custom-fields", response_model=list[CustomFieldDefOut])
async def list_custom_fields(
    applies_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(CustomFieldDef).where(CustomFieldDef.is_active == True)
    if applies_to:
        q = q.where(CustomFieldDef.applies_to == applies_to)
    result = await db.execute(q.order_by(CustomFieldDef.field_order))
    return result.scalars().all()


@router.post("/custom-fields", response_model=CustomFieldDefOut, status_code=201)
async def create_custom_field(
    payload: CustomFieldDefCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    field = CustomFieldDef(**payload.model_dump())
    db.add(field)
    await db.flush()
    return field


@router.patch("/custom-fields/{field_id}", response_model=CustomFieldDefOut)
async def update_custom_field(
    field_id: int,
    payload: CustomFieldDefUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(CustomFieldDef).where(CustomFieldDef.id == field_id))
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(field, k, v)
    return field


@router.delete("/custom-fields/{field_id}", status_code=204)
async def delete_custom_field(
    field_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(CustomFieldDef).where(CustomFieldDef.id == field_id))
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    field.is_active = False  # soft delete


# ── System Settings ───────────────────────────────────────────────────────────

@router.get("/system")
async def get_system_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(SystemSetting))
    rows = result.scalars().all()
    return {r.key: r.value for r in rows}


@router.put("/system/{key}")
async def upsert_system_setting(
    key: str,
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    value = str(body.get("value", ""))
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = value
    else:
        setting = SystemSetting(key=key, value=value)
        db.add(setting)
    return {"key": key, "value": value}


# ── Quote Template ────────────────────────────────────────────────────────────

QUOTE_TEMPLATE_KEY = "quote_template"
LOGO_DIR = os.path.join(
    os.environ.get("UPLOAD_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")),
    "logos",
)
os.makedirs(LOGO_DIR, exist_ok=True)

_DEFAULT_TEMPLATE = {
    "company_name": "Spreadshirt",
    "company_address": "Gießerstr. 27 · 04229 Leipzig · Germany",
    "company_email": "",
    "company_phone": "",
    "brand_color": "#e63329",
    "logo_url": None,
    "sections": [
        {"id": "header",    "label": "Header",        "enabled": True},
        {"id": "recipient", "label": "Recipient",     "enabled": True},
        {"id": "items",     "label": "Line Items",    "enabled": True},
        {"id": "totals",    "label": "Totals",        "enabled": True},
        {"id": "terms",     "label": "Payment Terms", "enabled": True},
        {"id": "notes",     "label": "Notes",         "enabled": True},
        {"id": "signature", "label": "Signature",     "enabled": True},
        {"id": "footer",    "label": "Footer",        "enabled": True},
    ],
    "footer_text": "This quote is valid for {validity_days} days from date of issue.",
    "show_vat_note": True,
}


async def _get_or_create_template(db: AsyncSession) -> dict:
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == QUOTE_TEMPLATE_KEY))
    row = result.scalar_one_or_none()
    if row:
        try:
            return json.loads(row.value)
        except Exception:
            pass
    return dict(_DEFAULT_TEMPLATE)


class QuoteTemplateUpdate(BaseModel):
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_email: Optional[str] = None
    company_phone: Optional[str] = None
    brand_color: Optional[str] = None
    sections: Optional[list[dict]] = None
    footer_text: Optional[str] = None
    show_vat_note: Optional[bool] = None
    number_format: Optional[dict] = None
    date_format: Optional[str] = None


@router.get("/quote-template")
async def get_quote_template(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Get the current quote template configuration."""
    return await _get_or_create_template(db)


@router.put("/quote-template")
async def update_quote_template(
    payload: QuoteTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Update quote template settings (admin only)."""
    tpl = await _get_or_create_template(db)
    updates = payload.model_dump(exclude_none=True)
    tpl.update(updates)

    value = json.dumps(tpl)
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == QUOTE_TEMPLATE_KEY))
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = value
    else:
        setting = SystemSetting(key=QUOTE_TEMPLATE_KEY, value=value)
        db.add(setting)

    return tpl


@router.post("/quote-template/logo")
async def upload_quote_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Upload company logo for the quote template (PNG/JPEG/SVG, max 5 MB)."""
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Logo too large (max 5 MB)")

    mime = (file.content_type or "").lower().split(";")[0].strip()
    allowed_logo_mimes = {"image/jpeg", "image/png", "image/svg+xml", "image/webp"}
    if mime not in allowed_logo_mimes:
        raise HTTPException(status_code=415, detail="Logo must be JPEG, PNG, SVG, or WebP")

    # Magic bytes check for raster images
    _LOGO_MAGIC = {
        "image/jpeg": [b"\xff\xd8\xff"],
        "image/png":  [b"\x89PNG\r\n\x1a\n"],
        "image/webp": [b"RIFF"],
    }
    sigs = _LOGO_MAGIC.get(mime, [])
    if sigs and not any(content[: len(s)] == s for s in sigs):
        raise HTTPException(status_code=415, detail="File content does not match declared type")

    ext = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/svg+xml": ".svg",
        "image/webp": ".webp",
    }[mime]
    filename = f"logo_{uuid.uuid4()}{ext}"

    logo_url = await storage_svc.upload("logos", filename, content, mime)
    # For local storage the service returns our internal path; keep that.
    # For Supabase it returns the public CDN URL directly.

    # Persist in template
    tpl = await _get_or_create_template(db)
    tpl["logo_url"] = logo_url
    value = json.dumps(tpl)
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == QUOTE_TEMPLATE_KEY))
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = value
    else:
        setting = SystemSetting(key=QUOTE_TEMPLATE_KEY, value=value)
        db.add(setting)

    return {"logo_url": logo_url}


# ── Role Permissions ─────────────────────────────────────────────────────────

ROLE_PERMISSIONS_KEY = "role_permissions"

_ALL_PERMS = [
    "view_dashboard", "view_leads", "view_deals", "view_accounts", "view_contacts",
    "view_quotes", "view_tasks", "view_reports", "view_data", "view_export",
    "leads_create", "leads_convert", "leads_delete",
    "deals_create", "deals_edit", "deals_delete", "deals_change_stage",
    "quotes_create", "quotes_send",
    "accounts_edit", "contacts_create", "activities_log",
]

DEFAULT_ROLE_PERMISSIONS: dict = {
    "sales_rep": {p: p in {
        "view_dashboard", "view_leads", "view_deals", "view_accounts", "view_contacts",
        "view_quotes", "view_tasks",
        "leads_create", "leads_convert",
        "deals_edit", "deals_change_stage",
        "quotes_create",
        "contacts_create", "activities_log",
    } for p in _ALL_PERMS},
    "account_manager": {p: p in {
        "view_dashboard", "view_leads", "view_deals", "view_accounts", "view_contacts",
        "view_quotes", "view_tasks", "view_reports", "view_data", "view_export",
        "leads_create", "leads_convert",
        "deals_create", "deals_edit", "deals_change_stage",
        "quotes_create", "quotes_send",
        "accounts_edit", "contacts_create", "activities_log",
    } for p in _ALL_PERMS},
    "sales_manager": {p: p not in {} for p in _ALL_PERMS},  # all true
    "admin": {p: True for p in _ALL_PERMS},  # always all true
}


@router.get("/role-permissions")
async def get_role_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == ROLE_PERMISSIONS_KEY)
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value:
        stored = json.loads(setting.value)
        # Merge with defaults so new permissions always have a value
        merged = {}
        for role, defaults in DEFAULT_ROLE_PERMISSIONS.items():
            merged[role] = {**defaults, **stored.get(role, {})}
        return merged
    return DEFAULT_ROLE_PERMISSIONS


@router.put("/role-permissions")
async def update_role_permissions(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    # Admin role always keeps all permissions regardless of what was sent
    body["admin"] = {p: True for p in _ALL_PERMS}
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == ROLE_PERMISSIONS_KEY)
    )
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = json.dumps(body)
    else:
        db.add(SystemSetting(key=ROLE_PERMISSIONS_KEY, value=json.dumps(body)))
    return body


# ── Currencies ───────────────────────────────────────────────────────────────

CURRENCY_SETTING_KEY = "currency_config"

DEFAULT_CURRENCY_CONFIG = {
    "base_currency": "EUR",
    "currencies": {
        "EUR": {"name": "Euro", "symbol": "€", "rate": 1.0},
        "USD": {"name": "US Dollar", "symbol": "$", "rate": 1.08},
        "GBP": {"name": "British Pound", "symbol": "£", "rate": 0.86},
        "CHF": {"name": "Swiss Franc", "symbol": "Fr", "rate": 0.94},
    },
}


class CurrencyEntry(BaseModel):
    name: str
    symbol: str
    rate: float


class CurrencyConfigUpdate(BaseModel):
    base_currency: str
    currencies: dict[str, CurrencyEntry]


async def _get_currency_config(db: AsyncSession) -> dict:
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == CURRENCY_SETTING_KEY)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return DEFAULT_CURRENCY_CONFIG
    return json.loads(row.value)


@router.get("/currencies")
async def get_currencies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_currency_config(db)


@router.put("/currencies")
async def update_currencies(
    payload: CurrencyConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if payload.base_currency not in payload.currencies:
        raise HTTPException(
            status_code=400,
            detail="base_currency must be present in currencies list",
        )
    # Ensure base currency always has rate 1.0
    data = payload.model_dump()
    data["currencies"][payload.base_currency]["rate"] = 1.0

    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == CURRENCY_SETTING_KEY)
    )
    row = result.scalar_one_or_none()
    if row is None:
        db.add(SystemSetting(key=CURRENCY_SETTING_KEY, value=json.dumps(data)))
    else:
        row.value = json.dumps(data)
    await db.commit()
    return data


@router.get("/quote-template/logo/{filename}")
async def serve_quote_logo(
    filename: str,
    request: Request,
):
    """Serve the stored company logo (requires authentication)."""
    from app.routers.uploads import _verify_token
    from fastapi.responses import FileResponse, RedirectResponse

    _verify_token(request)

    # Sanitize filename – no path traversal
    safe_name = os.path.basename(filename)
    ext = os.path.splitext(safe_name)[-1].lower()
    mime_map = {".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp"}
    mime = mime_map.get(ext, "application/octet-stream")

    if storage_svc.is_supabase():
        url = storage_svc.create_signed_url("logos", safe_name)
        if not url:
            raise HTTPException(status_code=404, detail="Logo not found in storage")
        return RedirectResponse(url=url, status_code=302)

    path = os.path.join(LOGO_DIR, safe_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Logo not found")
    return FileResponse(path, media_type=mime)
