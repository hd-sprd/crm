from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User, UserRole
from app.models.custom_report import CustomReport
from app.services.auth_service import get_current_user
from app.services.report_service import (
    get_pipeline_report,
    get_leads_report,
    get_performance_report,
    get_channels_report,
    get_accounts_report,
    get_summary_report,
    run_custom_report,
)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary")
async def summary_report(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    workflow_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_summary_report(db, date_from, date_to, workflow_id)


@router.get("/pipeline")
async def pipeline_report(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    workflow_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_pipeline_report(db, date_from, date_to, workflow_id)


@router.get("/leads")
async def leads_report(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_leads_report(db, date_from, date_to)


@router.get("/performance")
async def performance_report(
    user_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    workflow_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Sales reps can only see their own performance
    if current_user.role == UserRole.sales_rep:
        user_id = current_user.id
    return await get_performance_report(db, user_id, date_from, date_to, workflow_id)


@router.get("/channels")
async def channels_report(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_channels_report(db, date_from, date_to)


@router.get("/accounts")
async def accounts_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_accounts_report(db)


# ── Custom Reports ────────────────────────────────────────────────────────────

class CustomReportIn(BaseModel):
    name: str
    config: dict


class CustomReportOut(BaseModel):
    id: int
    name: str
    config: dict
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


@router.get("/custom", response_model=list[CustomReportOut])
async def list_custom_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(CustomReport).order_by(CustomReport.updated_at.desc()))
    return result.scalars().all()


@router.post("/custom", response_model=CustomReportOut, status_code=status.HTTP_201_CREATED)
async def create_custom_report(
    payload: CustomReportIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = CustomReport(name=payload.name, config=payload.config, created_by=current_user.id)
    db.add(report)
    await db.flush()
    return report


@router.patch("/custom/{report_id}", response_model=CustomReportOut)
async def update_custom_report(
    report_id: int,
    payload: CustomReportIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(CustomReport).where(CustomReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.name = payload.name
    report.config = payload.config
    await db.flush()
    return report


@router.delete("/custom/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(CustomReport).where(CustomReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    await db.delete(report)
    await db.flush()


@router.post("/custom/{report_id}/run")
async def run_saved_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(CustomReport).where(CustomReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    data = await run_custom_report(report.config, db)
    return {"data": data, "config": report.config}


@router.post("/custom/run")
async def run_adhoc_report(
    payload: CustomReportIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = await run_custom_report(payload.config, db)
    return {"data": data, "config": payload.config}
