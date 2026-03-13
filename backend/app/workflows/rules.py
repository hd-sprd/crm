"""
Workflow / Automation Rule Engine.
Called periodically (e.g. via scheduled job or after key mutations).
"""
from datetime import datetime, timedelta, date, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models.lead import Lead, LeadStatus
from app.models.deal import Deal, DealStage
from app.models.task import Task, TaskPriority, TaskStatus, RelatedToType
from app.models.quote import Quote, QuoteStatus
from app.models.activity import Activity


async def run_all_rules(db: AsyncSession) -> None:
    """Run all configured workflow rules."""
    await rule_lead_followup_reminder(db)
    await rule_inactive_deal_alert(db)
    await rule_quote_accepted_advance_deal(db)
    await rule_overdue_task_check(db)


async def rule_lead_followup_reminder(db: AsyncSession) -> None:
    """Create follow-up task if lead not contacted within N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.LEAD_FOLLOWUP_DAYS)
    result = await db.execute(
        select(Lead).where(
            Lead.status == LeadStatus.new,
            Lead.created_at <= cutoff,
        )
    )
    leads = result.scalars().all()
    for lead in leads:
        # Check if a reminder task already exists
        existing = await db.execute(
            select(Task).where(
                Task.related_to_type == RelatedToType.lead,
                Task.related_to_id == lead.id,
                Task.is_auto_generated == True,
                Task.status == TaskStatus.open,
            )
        )
        if existing.scalar_one_or_none():
            continue
        task = Task(
            title=f"Follow up with lead #{lead.id} ({lead.contact_name or lead.company_name})",
            related_to_type=RelatedToType.lead,
            related_to_id=lead.id,
            assigned_to=lead.assigned_to,
            due_date=date.today(),
            priority=TaskPriority.high,
            is_auto_generated=True,
        )
        db.add(task)
    await db.flush()


async def rule_inactive_deal_alert(db: AsyncSession) -> None:
    """Create alert task if deal has not been updated in N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.INACTIVE_DEAL_DAYS)
    result = await db.execute(
        select(Deal).where(
            Deal.stage.not_in([DealStage.lost, DealStage.on_hold, DealStage.deal_closed_won]),
            Deal.updated_at <= cutoff,
        )
    )
    deals = result.scalars().all()
    for deal in deals:
        existing = await db.execute(
            select(Task).where(
                Task.related_to_type == RelatedToType.deal,
                Task.related_to_id == deal.id,
                Task.is_auto_generated == True,
                Task.status == TaskStatus.open,
            )
        )
        if existing.scalar_one_or_none():
            continue
        task = Task(
            title=f"Deal #{deal.id} '{deal.title}' has been inactive for {settings.INACTIVE_DEAL_DAYS}+ days",
            related_to_type=RelatedToType.deal,
            related_to_id=deal.id,
            assigned_to=deal.assigned_to,
            due_date=date.today(),
            priority=TaskPriority.medium,
            is_auto_generated=True,
        )
        db.add(task)
    await db.flush()


async def rule_quote_accepted_advance_deal(db: AsyncSession) -> None:
    """When quote is accepted, advance deal to Order Confirmed (stage 9)."""
    result = await db.execute(
        select(Quote).where(
            Quote.status == QuoteStatus.accepted,
            Quote.accepted_at != None,
        )
    )
    quotes = result.scalars().all()
    for quote in quotes:
        deal_result = await db.execute(select(Deal).where(Deal.id == quote.deal_id))
        deal = deal_result.scalar_one_or_none()
        if deal and deal.stage not in (
            DealStage.order_confirmed, DealStage.order_created_erp,
            DealStage.deal_closed_won, DealStage.lost, DealStage.on_hold,
        ):
            deal.stage = DealStage.order_confirmed
    await db.flush()


async def rule_overdue_task_check(db: AsyncSession) -> None:
    """Log overdue tasks (could notify manager via separate notification system)."""
    today = date.today()
    result = await db.execute(
        select(Task).where(
            Task.status == TaskStatus.open,
            Task.due_date < today,
        )
    )
    overdue_tasks = result.scalars().all()
    # Extension point: send notifications to managers here
    # For now, just mark them as high priority
    for task in overdue_tasks:
        if task.priority != TaskPriority.high:
            task.priority = TaskPriority.high
    await db.flush()
