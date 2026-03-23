from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, cast, String
from datetime import datetime, timezone, timedelta

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


# ── Custom Report Engine ──────────────────────────────────────────────────────

def _get_entity_model(entity: str):
    from app.models.deal import Deal
    from app.models.lead import Lead
    from app.models.account import Account
    from app.models.contact import Contact
    return {"deals": Deal, "leads": Lead, "accounts": Account, "contacts": Contact}.get(entity)


def _resolve_field(model, field_name: str):
    """Return the SQLAlchemy column for a field name, with enum cast to string."""
    col = getattr(model, field_name, None)
    if col is None:
        return None
    return col


def _build_date_filter(model, date_field: str, date_range: str, date_from=None, date_to=None):
    col = _resolve_field(model, date_field)
    if col is None:
        return None
    now = datetime.now(timezone.utc)
    if date_range == "this_month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return col >= start
    if date_range == "last_30":
        return col >= now - timedelta(days=30)
    if date_range == "last_90":
        return col >= now - timedelta(days=90)
    if date_range == "this_year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        return col >= start
    if date_range == "custom":
        filters = []
        if date_from:
            filters.append(col >= date_from)
        if date_to:
            filters.append(col <= date_to)
        return and_(*filters) if filters else None
    return None  # "all"


def _apply_filter(model, f: dict):
    field = f.get("field")
    op = f.get("op", "eq")
    value = f.get("value")
    col = _resolve_field(model, field)
    if col is None:
        return None
    if op == "eq":
        return col == value
    if op == "neq":
        return col != value
    if op == "contains":
        return cast(col, String).ilike(f"%{value}%")
    if op == "in":
        vals = value if isinstance(value, list) else str(value).split(",")
        return col.in_(vals)
    return None


async def run_custom_report(config: dict, db: AsyncSession) -> list:
    entity = config.get("entity", "deals")
    model = _get_entity_model(entity)
    if model is None:
        return []

    metrics = config.get("metrics") or [{"func": "count", "field": "id"}]
    group_by_key = config.get("group_by")
    date_field = config.get("date_field", "created_at")
    date_range = config.get("date_range", "all")
    date_from = config.get("date_from")
    date_to = config.get("date_to")
    filters = config.get("filters") or []

    # Build group_by expression
    group_expr = None
    group_label = "group"
    if group_by_key in ("month", "week"):
        trunc = "month" if group_by_key == "month" else "week"
        df_col = _resolve_field(model, date_field) or _resolve_field(model, "created_at")
        group_expr = func.date_trunc(trunc, df_col)
        group_label = group_by_key
    elif group_by_key:
        group_expr = _resolve_field(model, group_by_key)
        group_label = group_by_key

    # Build metric expressions
    agg_map = {"count": func.count, "sum": func.sum, "avg": func.avg}
    agg_exprs = []
    agg_labels = []
    for m in metrics:
        fn = agg_map.get(m.get("func", "count"), func.count)
        field_col = _resolve_field(model, m.get("field", "id"))
        if field_col is None:
            field_col = model.id
        agg_exprs.append(fn(field_col))
        agg_labels.append(f"{m.get('func', 'count')}_{m.get('field', 'id')}")

    # SELECT
    if group_expr is not None:
        q = select(cast(group_expr, String).label("grp"), *agg_exprs).group_by(group_expr).order_by(group_expr)
    else:
        q = select(*agg_exprs)

    # Date filter
    date_cond = _build_date_filter(model, date_field, date_range, date_from, date_to)
    if date_cond is not None:
        q = q.where(date_cond)

    # Custom filters
    for f in filters:
        cond = _apply_filter(model, f)
        if cond is not None:
            q = q.where(cond)

    result = await db.execute(q)
    rows = result.all()

    out = []
    for row in rows:
        if group_expr is not None:
            entry = {group_label: row[0]}
            for i, label in enumerate(agg_labels):
                v = row[i + 1]
                entry[label] = float(v) if v is not None else 0
        else:
            entry = {}
            for i, label in enumerate(agg_labels):
                v = row[i]
                entry[label] = float(v) if v is not None else 0
        out.append(entry)
    return out
