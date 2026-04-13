"""v14 enable row-level security

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-04-01 10:00:00.000000

Enables RLS on all tables so that the anon role cannot access data
via PostgREST / Supabase REST API. The app connects as the postgres
superuser which bypasses RLS, so no additional policies are required.
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'l2m3n4o5p6q7'
down_revision: Union[str, None] = 'k1l2m3n4o5p6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = [
    'users',
    'accounts',
    'contacts',
    'leads',
    'deals',
    'quotes',
    'activities',
    'tasks',
    'attachments',
    'audit_logs',
    'notifications',
    'saved_views',
    'workflows',
    'workflow_stages',
    'sequences',
    'sequence_steps',
    'sequence_enrollments',
    'custom_reports',
    'system_settings',
    'custom_field_defs',
]


def upgrade() -> None:
    for table in TABLES:
        op.execute(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    for table in TABLES:
        op.execute(f'ALTER TABLE public."{table}" DISABLE ROW LEVEL SECURITY')
