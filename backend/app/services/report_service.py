from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from datetime import datetime, timezone

from app.models.deal import Deal, DealStage, STAGE_ORDER
from app.models.lead import Lead, LeadStatus
from app.models.activity import Activity


async def get_pipeline_report(db: AsyncSession) -> dict:
    result = await db.execute(
        select(Deal.stage, func.count(Deal.id), func.sum(Deal.value_eur))
        .group_by(Deal.stage)
    )
    rows = result.all()
    stages = {}
    for stage, count, value in rows:
        stages[str(stage)] = {"count": count, "total_value_eur": float(value or 0)}
    return {"pipeline": stages}


async def get_leads_report(db: AsyncSession) -> dict:
    result = await db.execute(
        select(Lead.status, func.count(Lead.id)).group_by(Lead.status)
    )
    rows = result.all()
    return {"leads_by_status": {s.value: c for s, c in rows}}


async def get_performance_report(db: AsyncSession, user_id: int | None = None) -> dict:
    query = select(
        Deal.assigned_to,
        func.count(Deal.id).filter(Deal.stage == DealStage.deal_closed_won).label("won"),
        func.count(Deal.id).filter(Deal.stage == DealStage.lost).label("lost"),
        func.sum(Deal.value_eur).filter(Deal.stage == DealStage.deal_closed_won).label("won_value"),
    ).group_by(Deal.assigned_to)
    if user_id:
        query = query.where(Deal.assigned_to == user_id)
    result = await db.execute(query)
    rows = result.all()
    return {
        "performance": [
            {
                "user_id": row.assigned_to,
                "won": row.won,
                "lost": row.lost,
                "won_value_eur": float(row.won_value or 0),
            }
            for row in rows
        ]
    }


async def get_channels_report(db: AsyncSession) -> dict:
    result = await db.execute(
        select(Lead.source, func.count(Lead.id)).group_by(Lead.source)
    )
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
