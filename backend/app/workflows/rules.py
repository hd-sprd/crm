"""
Workflow / Automation Rule Engine.
Called periodically (e.g. via scheduled job or after key mutations).
"""
from datetime import datetime, timedelta, date, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models.lead import Lead, LeadStatus
from app.models.deal import Deal
from app.models.workflow import WorkflowStage
from app.models.task import Task, TaskPriority, TaskStatus, RelatedToType
from app.models.quote import Quote, QuoteStatus
from app.models.activity import Activity
from app.models.sequence import SequenceEnrollment, SequenceStep
from app.routers.notifications import create_notification


async def run_all_rules(db: AsyncSession) -> None:
    """Run all configured workflow rules."""
    await rule_lead_followup_reminder(db)
    await rule_inactive_deal_alert(db)
    await rule_quote_accepted_advance_deal(db)
    await rule_overdue_task_check(db)
    await rule_process_sequence_steps(db)


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
        if lead.assigned_to:
            await create_notification(db, user_id=lead.assigned_to, type="lead_followup",
                                      title=f"Follow-up needed: {lead.contact_name or lead.company_name or f'Lead #{lead.id}'}",
                                      body=f"No contact in {settings.LEAD_FOLLOWUP_DAYS}+ days",
                                      entity_type="lead", entity_id=lead.id)
    await db.flush()


async def rule_inactive_deal_alert(db: AsyncSession) -> None:
    """Create alert task if deal has not been updated in N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.INACTIVE_DEAL_DAYS)
    # Exclude deals whose stage is is_won or is_lost in their workflow
    done_stages = await db.execute(
        select(WorkflowStage.key, WorkflowStage.workflow_id).where(
            (WorkflowStage.is_won == True) | (WorkflowStage.is_lost == True)
        )
    )
    done_pairs = {(r[1], r[0]) for r in done_stages.all()}  # (workflow_id, key)

    result = await db.execute(
        select(Deal).where(Deal.updated_at <= cutoff)
    )
    all_deals = result.scalars().all()
    deals = [d for d in all_deals if (d.workflow_id, d.stage) not in done_pairs]
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
        if deal.assigned_to:
            await create_notification(db, user_id=deal.assigned_to, type="deal_stale",
                                      title=f"Deal stale: {deal.title}",
                                      body=f"No activity for {settings.INACTIVE_DEAL_DAYS}+ days",
                                      entity_type="deal", entity_id=deal.id)
    await db.flush()


async def rule_quote_accepted_advance_deal(db: AsyncSession) -> None:
    """When quote is accepted, advance deal to the workflow's quote_approval_target_stage."""
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
        if not deal or not deal.workflow:
            continue
        target_key = deal.workflow.quote_approval_target_stage
        if not target_key:
            continue
        # Only advance if deal is not already at/past the target stage
        current_s = await db.execute(
            select(WorkflowStage).where(
                WorkflowStage.workflow_id == deal.workflow_id,
                WorkflowStage.key == deal.stage,
            )
        )
        target_s = await db.execute(
            select(WorkflowStage).where(
                WorkflowStage.workflow_id == deal.workflow_id,
                WorkflowStage.key == target_key,
            )
        )
        current_stage = current_s.scalar_one_or_none()
        target_stage = target_s.scalar_one_or_none()
        if current_stage and target_stage and current_stage.stage_order < target_stage.stage_order:
            deal.stage = target_key
    await db.flush()


async def rule_process_sequence_steps(db: AsyncSession) -> None:
    """Process due sequence enrollment steps and create tasks/activities."""
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(SequenceEnrollment)
        .options(selectinload(SequenceEnrollment.sequence).selectinload("steps"))
        .where(
            SequenceEnrollment.completed_at.is_(None),
            SequenceEnrollment.paused.is_(False),
        )
    )
    enrollments = result.scalars().all()
    today = datetime.now(timezone.utc).date()

    for enrollment in enrollments:
        steps = sorted(enrollment.sequence.steps, key=lambda s: s.step_order)
        if enrollment.current_step >= len(steps):
            enrollment.completed_at = datetime.now(timezone.utc)
            continue

        # Check if the current step's cumulative delay has elapsed
        cumulative_days = sum(s.delay_days for s in steps[:enrollment.current_step + 1])
        due_date = (enrollment.enrolled_at.date() + timedelta(days=cumulative_days))
        if due_date > today:
            continue

        step = steps[enrollment.current_step]
        if step.action_type == "task":
            related_type = RelatedToType.deal if enrollment.entity_type == "deal" else RelatedToType.lead
            task = Task(
                title=step.title,
                description=step.body,
                related_to_type=related_type,
                related_to_id=enrollment.entity_id,
                due_date=today,
                priority=TaskPriority.medium,
                is_auto_generated=True,
            )
            db.add(task)
        else:
            # note → Activity
            activity = Activity(
                type="note",
                subject=step.title,
                body=step.body,
                related_to_type=enrollment.entity_type,
                related_to_id=enrollment.entity_id,
            )
            db.add(activity)

        enrollment.current_step += 1
        if enrollment.current_step >= len(steps):
            enrollment.completed_at = datetime.now(timezone.utc)

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
            if task.assigned_to:
                await create_notification(db, user_id=task.assigned_to, type="task_overdue",
                                          title=f"Task overdue: {task.title}",
                                          body=f"Due {task.due_date}",
                                          entity_type="task", entity_id=task.id)
    await db.flush()
