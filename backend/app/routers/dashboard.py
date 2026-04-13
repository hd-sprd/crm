"""
GET /api/v1/dashboard

Aggregierter Endpunkt: ruft die PostgreSQL-Funktion get_dashboard_data() auf
und gibt Leads, Tasks und Activities in einem einzigen Supabase-Roundtrip zurück.
Spart 3 separate API-Calls gegenüber dem bisherigen Frontend-Pattern.
"""
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Liefert Leads (neu), offene Tasks und recent Activities in einem DB-Call.
    Filter nach assigned_to wenn Rolle nicht sales_manager/admin.
    """
    is_manager = current_user.role in ("sales_manager", "admin")
    assigned_to = None if is_manager else current_user.id

    result = await db.execute(
        text("SELECT get_dashboard_data(:assigned_to, 20, 20, 15)"),
        {"assigned_to": assigned_to},
    )
    data = result.scalar_one()
    # data ist bereits JSON/dict aus PostgreSQL
    return JSONResponse(content=data if isinstance(data, dict) else {})
