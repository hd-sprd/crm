from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timezone

from app.models.deal import Deal
from app.models.lead import Lead, LeadStatus
from app.models.activity import Activity
from app.models.user import User
from app.models.workflow import WorkflowStage


async def get_pipeline_report(
    db: AsyncSession,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    workflow_id: int | None = None,
) -> dict:
    q = select(
        Deal.stage,
        func.count(Deal.id),
        func.sum(Deal.value_eur * Deal.exchange_rate_eur),
    ).group_by(Deal.stage)
    if workflow_id:
        q = q.where(Deal.workflow_id == workflow_id)
    if date_from:
        q = q.where(Deal.created_at >= date_from)
    if date_to:
        q = q.where(Deal.created_at <= date_to)
    result = await db.execute(q)
    rows = result.all()
    stages = {}
    for stage, count, value in rows:
        stages[str(stage)] = {"count": count, "total_value_eur": float(value or 0)}
    return {"pipeline": stages}


async def get_leads_report(
    db: AsyncSession,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> dict:
    q = select(Lead.status, func.count(Lead.id)).group_by(Lead.status)
    if date_from:
        q = q.where(Lead.created_at >= date_from)
    if date_to:
        q = q.where(Lead.created_at <= date_to)
    result = await db.execute(q)
    rows = result.all()
    return {"leads_by_status": {s.value: c for s, c in rows}}


async def get_performance_report(
    db: AsyncSession,
    user_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    workflow_id: int | None = None,
) -> dict:
    q = select(
        Deal.assigned_to,
        User.full_name,
        func.count(Deal.id).filter(WorkflowStage.is_won.is_(True)).label("won"),
        func.count(Deal.id).filter(WorkflowStage.is_lost.is_(True)).label("lost"),
        func.count(Deal.id).filter(
            WorkflowStage.is_won.is_not(True),
            WorkflowStage.is_lost.is_not(True),
        ).label("open"),
        func.sum(Deal.value_eur * Deal.exchange_rate_eur).filter(
            WorkflowStage.is_won.is_(True)
        ).label("won_value"),
        func.sum(Deal.value_eur * Deal.exchange_rate_eur).filter(
            WorkflowStage.is_won.is_not(True),
            WorkflowStage.is_lost.is_not(True),
        ).label("pipeline_value"),
    ).outerjoin(User, User.id == Deal.assigned_to).outerjoin(
        WorkflowStage,
        and_(
            WorkflowStage.workflow_id == Deal.workflow_id,
            WorkflowStage.key == Deal.stage,
        ),
    ).group_by(Deal.assigned_to, User.full_name)
    if workflow_id:
        q = q.where(Deal.workflow_id == workflow_id)
    if user_id:
        q = q.where(Deal.assigned_to == user_id)
    if date_from:
        q = q.where(Deal.created_at >= date_from)
    if date_to:
        q = q.where(Deal.created_at <= date_to)
    result = await db.execute(q)
    rows = result.all()
    return {
        "performance": [
            {
                "user_id": row.assigned_to,
                "user_name": row.full_name or f"User #{row.assigned_to}",
                "won": row.won,
                "lost": row.lost,
                "open": row.open,
                "won_value_eur": float(row.won_value or 0),
                "pipeline_value_eur": float(row.pipeline_value or 0),
            }
            for row in rows
        ]
    }


async def get_summary_report(
    db: AsyncSession,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    workflow_id: int | None = None,
) -> dict:
    """Overall KPI summary stats."""
    deal_q = select(
        func.count(Deal.id).label("total_deals"),
        func.count(Deal.id).filter(WorkflowStage.is_won.is_(True)).label("won_deals"),
        func.count(Deal.id).filter(WorkflowStage.is_lost.is_(True)).label("lost_deals"),
        func.sum(Deal.value_eur * Deal.exchange_rate_eur).filter(
            WorkflowStage.is_won.is_not(True),
            WorkflowStage.is_lost.is_not(True),
        ).label("pipeline_value"),
        func.sum(Deal.value_eur * Deal.exchange_rate_eur).filter(
            WorkflowStage.is_won.is_(True)
        ).label("won_value"),
    ).outerjoin(
        WorkflowStage,
        and_(
            WorkflowStage.workflow_id == Deal.workflow_id,
            WorkflowStage.key == Deal.stage,
        ),
    )
    if workflow_id:
        deal_q = deal_q.where(Deal.workflow_id == workflow_id)
    if date_from:
        deal_q = deal_q.where(Deal.created_at >= date_from)
    if date_to:
        deal_q = deal_q.where(Deal.created_at <= date_to)
    deal_row = (await db.execute(deal_q)).one()

    lead_q = select(func.count(Lead.id).label("total_leads"))
    if date_from:
        lead_q = lead_q.where(Lead.created_at >= date_from)
    if date_to:
        lead_q = lead_q.where(Lead.created_at <= date_to)
    lead_row = (await db.execute(lead_q)).one()

    total = deal_row.won_deals + deal_row.lost_deals
    win_rate = round(deal_row.won_deals / total * 100) if total > 0 else 0

    return {
        "total_deals": deal_row.total_deals,
        "won_deals": deal_row.won_deals,
        "lost_deals": deal_row.lost_deals,
        "win_rate": win_rate,
        "pipeline_value_eur": float(deal_row.pipeline_value or 0),
        "won_value_eur": float(deal_row.won_value or 0),
        "total_leads": lead_row.total_leads,
    }


async def get_channels_report(
    db: AsyncSession,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> dict:
    q = select(Lead.source, func.count(Lead.id)).group_by(Lead.source)
    if date_from:
        q = q.where(Lead.created_at >= date_from)
    if date_to:
        q = q.where(Lead.created_at <= date_to)
    result = await db.execute(q)
    rows = result.all()
    return {"leads_by_channel": {s.value: c for s, c in rows}}


async def get_accounts_report(db: AsyncSession) -> dict:
    from app.models.account import Account
    result = await db.execute(
        select(
            Account.id,
            Account.name,
            func.count(Deal.id).label("open_deals"),
        )
        .outerjoin(Deal, Deal.account_id == Account.id)
        .group_by(Account.id, Account.name)
    )
    rows = result.all()
    return {
        "accounts": [
            {"account_id": row.id, "name": row.name, "open_deals": row.open_deals}
            for row in rows
        ]
    }
