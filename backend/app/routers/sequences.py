from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel

from app.database import get_db
from app.models.sequence import Sequence, SequenceStep, SequenceEnrollment
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/sequences", tags=["sequences"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class StepIn(BaseModel):
    step_order: int
    delay_days: int = 0
    action_type: str = "task"  # task | note
    title: str
    body: Optional[str] = None


class StepOut(BaseModel):
    id: int
    sequence_id: int
    step_order: int
    delay_days: int
    action_type: str
    title: str
    body: Optional[str]
    model_config = {"from_attributes": True}


class SequenceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    applies_to: str = "deal"  # deal | lead
    is_active: bool = True
    steps: List[StepIn] = []


class SequenceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    applies_to: Optional[str] = None
    is_active: Optional[bool] = None


class SequenceOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    applies_to: str
    is_active: bool
    created_by: Optional[int]
    created_at: datetime
    steps: List[StepOut] = []
    model_config = {"from_attributes": True}


class EnrollIn(BaseModel):
    entity_type: str  # deal | lead
    entity_id: int


class EnrollmentOut(BaseModel):
    id: int
    sequence_id: int
    entity_type: str
    entity_id: int
    enrolled_by: Optional[int]
    current_step: int
    enrolled_at: datetime
    completed_at: Optional[datetime]
    paused: bool
    sequence: Optional[SequenceOut] = None
    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[SequenceOut])
async def list_sequences(
    applies_to: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Sequence).options(selectinload(Sequence.steps))
    if applies_to:
        q = q.where(Sequence.applies_to == applies_to)
    if is_active is not None:
        q = q.where(Sequence.is_active == is_active)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=SequenceOut, status_code=status.HTTP_201_CREATED)
async def create_sequence(
    payload: SequenceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    seq = Sequence(
        name=payload.name,
        description=payload.description,
        applies_to=payload.applies_to,
        is_active=payload.is_active,
        created_by=current_user.id,
    )
    db.add(seq)
    await db.flush()
    for s in payload.steps:
        db.add(SequenceStep(sequence_id=seq.id, **s.model_dump()))
    await db.flush()
    await db.refresh(seq, ["steps"])
    return seq


@router.get("/enrollments", response_model=List[EnrollmentOut])
async def list_enrollments(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(SequenceEnrollment).options(
        selectinload(SequenceEnrollment.sequence).selectinload(Sequence.steps)
    )
    if entity_type:
        q = q.where(SequenceEnrollment.entity_type == entity_type)
    if entity_id is not None:
        q = q.where(SequenceEnrollment.entity_id == entity_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{sequence_id}", response_model=SequenceOut)
async def get_sequence(
    sequence_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Sequence).options(selectinload(Sequence.steps)).where(Sequence.id == sequence_id)
    )
    seq = result.scalar_one_or_none()
    if not seq:
        raise HTTPException(status_code=404, detail="Sequence not found")
    return seq


@router.patch("/{sequence_id}", response_model=SequenceOut)
async def update_sequence(
    sequence_id: int,
    payload: SequenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Sequence).options(selectinload(Sequence.steps)).where(Sequence.id == sequence_id)
    )
    seq = result.scalar_one_or_none()
    if not seq:
        raise HTTPException(status_code=404, detail="Sequence not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(seq, field, value)
    await db.flush()
    return seq


@router.delete("/{sequence_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sequence(
    sequence_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Sequence).where(Sequence.id == sequence_id))
    seq = result.scalar_one_or_none()
    if not seq:
        raise HTTPException(status_code=404, detail="Sequence not found")
    # Block if active enrollments
    active = await db.execute(
        select(SequenceEnrollment).where(
            SequenceEnrollment.sequence_id == sequence_id,
            SequenceEnrollment.completed_at.is_(None),
        )
    )
    if active.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Sequence has active enrollments")
    await db.delete(seq)
    await db.flush()


@router.post("/{sequence_id}/steps", response_model=StepOut, status_code=status.HTTP_201_CREATED)
async def add_step(
    sequence_id: int,
    payload: StepIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    step = SequenceStep(sequence_id=sequence_id, **payload.model_dump())
    db.add(step)
    await db.flush()
    return step


@router.patch("/steps/{step_id}", response_model=StepOut)
async def update_step(
    step_id: int,
    payload: StepIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(SequenceStep).where(SequenceStep.id == step_id))
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(step, field, value)
    await db.flush()
    return step


@router.delete("/steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_step(
    step_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(SequenceStep).where(SequenceStep.id == step_id))
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    await db.delete(step)
    await db.flush()


@router.post("/{sequence_id}/enroll", response_model=EnrollmentOut, status_code=status.HTTP_201_CREATED)
async def enroll(
    sequence_id: int,
    payload: EnrollIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check sequence exists
    seq = await db.execute(select(Sequence).where(Sequence.id == sequence_id))
    if not seq.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Sequence not found")
    # Check not already enrolled
    existing = await db.execute(
        select(SequenceEnrollment).where(
            SequenceEnrollment.sequence_id == sequence_id,
            SequenceEnrollment.entity_type == payload.entity_type,
            SequenceEnrollment.entity_id == payload.entity_id,
            SequenceEnrollment.completed_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already enrolled in this sequence")
    enrollment = SequenceEnrollment(
        sequence_id=sequence_id,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        enrolled_by=current_user.id,
        enrolled_at=datetime.now(timezone.utc),
    )
    db.add(enrollment)
    await db.flush()
    await db.refresh(enrollment, ["sequence"])
    return enrollment


@router.delete("/enrollments/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unenroll(
    enrollment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(SequenceEnrollment).where(SequenceEnrollment.id == enrollment_id))
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    await db.delete(enrollment)
    await db.flush()
