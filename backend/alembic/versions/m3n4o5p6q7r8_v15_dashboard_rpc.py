"""v15 dashboard rpc function

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2026-04-13 10:00:00.000000

PostgreSQL-Funktion get_dashboard_data(), die Leads, Tasks und Activities
in einem einzigen DB-Roundtrip nach Irland (Supabase) bündelt.
Aufgerufen vom /api/v1/dashboard Endpunkt statt fünf separater Abfragen.
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'm3n4o5p6q7r8'
down_revision: Union[str, None] = 'l2m3n4o5p6q7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
CREATE OR REPLACE FUNCTION get_dashboard_data(
    p_assigned_to INTEGER DEFAULT NULL,
    p_limit_leads  INTEGER DEFAULT 20,
    p_limit_tasks  INTEGER DEFAULT 20,
    p_limit_activities INTEGER DEFAULT 15
)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
    SELECT json_build_object(
        'leads', COALESCE((
            SELECT json_agg(l)
            FROM (
                SELECT id, source, status, company_name, contact_name, contact_email,
                       assigned_to, created_at, updated_at
                FROM leads
                WHERE status = 'new'
                  AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
                ORDER BY created_at DESC
                LIMIT p_limit_leads
            ) l
        ), '[]'::json),
        'tasks', COALESCE((
            SELECT json_agg(t)
            FROM (
                SELECT id, title, status, due_date, priority,
                       assigned_to, related_to_type, related_to_id, created_at
                FROM tasks
                WHERE status = 'open'
                  AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
                ORDER BY due_date ASC NULLS LAST, created_at DESC
                LIMIT p_limit_tasks
            ) t
        ), '[]'::json),
        'activities', COALESCE((
            SELECT json_agg(a)
            FROM (
                SELECT id, type, subject, body, due_date,
                       assigned_to, related_to_type, related_to_id, created_at
                FROM activities
                WHERE (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
                ORDER BY created_at DESC
                LIMIT p_limit_activities
            ) a
        ), '[]'::json)
    )
$$;
""")


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS get_dashboard_data(INTEGER, INTEGER, INTEGER, INTEGER)")
