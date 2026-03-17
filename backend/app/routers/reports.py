from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.models.user import User, UserRole
from app.services.auth_service import get_current_user
from app.services.report_service import (
    get_pipeline_report,
    get_leads_report,
    get_performance_report,
    get_channels_report,
    get_accounts_report,
    get_summary_report,
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
