from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deal import Deal, STAGE_ORDER


async def validate_stage_transition(deal: Deal, new_stage: str, db: AsyncSession) -> None:
    """Enforce business rules before allowing a stage change."""

    def stage_idx(s: str) -> int:
        return STAGE_ORDER.index(s) if s in STAGE_ORDER else -1

    negotiation_idx = stage_idx("negotiation")
    order_confirmed_idx = stage_idx("order_confirmed")
    production_planning_idx = stage_idx("production_planning")

    new_idx = stage_idx(new_stage)

    # Quote required to advance past negotiation
    if new_idx >= negotiation_idx and new_stage not in ("lost", "on_hold") and new_idx >= 0:
        if not deal.quote_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A deal cannot advance past Quote Sent without an associated Quote.",
            )

    # Feasibility required before Order Confirmed
    if new_idx >= order_confirmed_idx and new_idx >= 0:
        if not deal.feasibility_checked:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Feasibility must be confirmed before Order Confirmed.",
            )

    # Artwork approval required before Production Planning
    if new_idx >= production_planning_idx and new_idx >= 0:
        if not deal.artwork_approved:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Artwork must be approved before Production Planning.",
            )

    # Invoice reference required before Payment Received / Closed Won
    if new_stage in ("payment_received", "deal_closed_won"):
        if not deal.invoice_reference:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invoice reference must be set before Payment Received.",
            )

    # Lost requires reason
    if new_stage == "lost" and not deal.lost_reason:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A lost reason must be provided when marking a deal as Lost.",
        )
