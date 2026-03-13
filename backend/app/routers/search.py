from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.database import get_db
from app.models.account import Account
from app.models.contact import Contact
from app.models.lead import Lead
from app.models.deal import Deal
from app.models.task import Task
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
async def global_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(5, le=10),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not q.strip():
        return {"accounts": [], "contacts": [], "leads": [], "deals": [], "tasks": []}

    pattern = f"%{q.strip()}%"

    # Accounts
    acc_q = select(Account).where(Account.name.ilike(pattern)).limit(limit)
    acc_res = await db.execute(acc_q)
    accounts = [
        {"id": a.id, "title": a.name, "subtitle": f"{a.type} · {a.status}", "url": f"/accounts/{a.id}"}
        for a in acc_res.scalars().all()
    ]

    # Contacts
    con_q = select(Contact).where(
        or_(
            Contact.first_name.ilike(pattern),
            Contact.last_name.ilike(pattern),
            Contact.email.ilike(pattern),
        )
    ).limit(limit)
    con_res = await db.execute(con_q)
    contacts = [
        {
            "id": c.id,
            "title": f"{c.first_name} {c.last_name}".strip(),
            "subtitle": c.email or c.title or "",
            "url": f"/contacts",
        }
        for c in con_res.scalars().all()
    ]

    # Leads
    lead_q = select(Lead).where(
        or_(
            Lead.company_name.ilike(pattern),
            Lead.contact_name.ilike(pattern),
            Lead.contact_email.ilike(pattern),
        )
    ).limit(limit)
    lead_res = await db.execute(lead_q)
    leads = [
        {
            "id": l.id,
            "title": l.company_name or l.contact_name or f"Lead #{l.id}",
            "subtitle": f"{l.status} · {l.source}",
            "url": f"/leads",
        }
        for l in lead_res.scalars().all()
    ]

    # Deals
    deal_q = select(Deal).where(Deal.title.ilike(pattern)).limit(limit)
    deal_res = await db.execute(deal_q)
    deals = [
        {"id": d.id, "title": d.title, "subtitle": d.stage.replace("_", " "), "url": f"/deals"}
        for d in deal_res.scalars().all()
    ]

    # Tasks
    task_q = select(Task).where(Task.title.ilike(pattern)).limit(limit)
    task_res = await db.execute(task_q)
    tasks = [
        {"id": t.id, "title": t.title, "subtitle": f"{t.priority} priority · {t.status}", "url": f"/tasks"}
        for t in task_res.scalars().all()
    ]

    return {
        "accounts": accounts,
        "contacts": contacts,
        "leads": leads,
        "deals": deals,
        "tasks": tasks,
    }
