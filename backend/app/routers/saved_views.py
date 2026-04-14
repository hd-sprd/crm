from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Any

from app.database import get_db
from app.models.saved_view import SavedView
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/saved-views", tags=["saved-views"])


class SavedViewCreate(BaseModel):
    entity_type: str
    name: str
    filters: dict[str, Any] = {}


class SavedViewOut(BaseModel):
    id: int
    user_id: int
    entity_type: str
    name: str
    filters: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=list[SavedViewOut])
async def list_saved_views(
    entity_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(SavedView).where(SavedView.user_id == current_user.id)
    if entity_type:
        q = q.where(SavedView.entity_type == entity_type)
    q = q.order_by(SavedView.created_at.asc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", status_code=201, response_model=SavedViewOut)
async def create_saved_view(
    payload: SavedViewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    view = SavedView(
        user_id=current_user.id,
        entity_type=payload.entity_type,
        name=payload.name,
        filters=payload.filters,
    )
    db.add(view)
    await db.flush()
    return view


@router.delete("/{view_id}")
async def delete_saved_view(
    view_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SavedView).where(
            SavedView.id == view_id,
            SavedView.user_id == current_user.id,
        )
    )
    view = result.scalar_one_or_none()
    if not view:
        raise HTTPException(status_code=404, detail="Saved view not found")
    await db.delete(view)
    return {"ok": True}
