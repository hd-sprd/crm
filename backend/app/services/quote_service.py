from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.quote import Quote
from app.schemas.quote import QuoteCreate


async def get_next_version(deal_id: int, db: AsyncSession) -> int:
    result = await db.execute(
        select(func.max(Quote.version)).where(Quote.deal_id == deal_id)
    )
    max_version = result.scalar_one_or_none()
    return (max_version or 0) + 1


async def calculate_total(line_items: list[dict], shipping: float, production: float) -> float:
    lines_total = sum(item.get("total", 0) for item in line_items)
    return round(lines_total + shipping + production, 2)


async def create_quote_version(payload: QuoteCreate, db: AsyncSession) -> Quote:
    version = await get_next_version(payload.deal_id, db)
    items = [item.model_dump() for item in payload.line_items]
    total = await calculate_total(items, payload.shipping_cost, payload.production_cost)

    quote = Quote(
        deal_id=payload.deal_id,
        version=version,
        line_items=items,
        shipping_cost=payload.shipping_cost,
        production_cost=payload.production_cost,
        total_value=total,
        payment_terms=payload.payment_terms,
        validity_days=payload.validity_days,
        notes=payload.notes,
    )
    db.add(quote)
    await db.flush()
    return quote
