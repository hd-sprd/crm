from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.workflow import Workflow, WorkflowStage
from app.models.quote import Quote, QuoteStatus


async def get_default_workflow_id(db: AsyncSession) -> int | None:
    result = await db.execute(select(Workflow.id).where(Workflow.is_default == True))
    return result.scalar_one_or_none()


async def get_first_stage_key(workflow_id: int, db: AsyncSession) -> str:
    """Return the key of the first active stage in the workflow (lowest stage_order)."""
    result = await db.execute(
        select(WorkflowStage.key)
        .where(WorkflowStage.workflow_id == workflow_id, WorkflowStage.is_active == True)
        .order_by(WorkflowStage.stage_order)
        .limit(1)
    )
    key = result.scalar_one_or_none()
    return key or "lead_received"


async def validate_stage_transition(deal, new_stage: str, db: AsyncSession) -> None:
    """Enforce business rules before allowing a stage change."""
    result = await db.execute(
        select(WorkflowStage).where(
            WorkflowStage.workflow_id == deal.workflow_id,
            WorkflowStage.key == new_stage,
            WorkflowStage.is_active == True,
        )
    )
    stage = result.scalar_one_or_none()

    if stage is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Stage '{new_stage}' not found in this workflow.",
        )

    if stage.requires_quote and not deal.quote_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A deal cannot advance to this stage without an associated Quote.",
        )

    if stage.requires_approved_quote:
        quote = None
        if deal.quote_id:
            q_result = await db.execute(select(Quote).where(Quote.id == deal.quote_id))
            quote = q_result.scalar_one_or_none()
        if not quote or quote.status != QuoteStatus.accepted:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="An approved (accepted) Quote is required for this stage.",
            )

    if stage.requires_feasibility and not deal.feasibility_checked:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Feasibility must be confirmed before this stage.",
        )

    if stage.requires_artwork and not deal.artwork_approved:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Artwork must be approved before this stage.",
        )

    if stage.requires_invoice and not deal.invoice_reference:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invoice reference must be set before this stage.",
        )

    if stage.is_lost and not deal.lost_reason:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A lost reason must be provided when marking a deal as Lost.",
        )
